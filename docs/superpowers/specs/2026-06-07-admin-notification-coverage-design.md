# Admin Notification Coverage & Approval Gating — Design Spec

**Date:** 2026-06-07
**Status:** Approved by owner (design discussion 2026-06-06/07)

## Problem

A full audit of the site found three related problems:

1. **Approval gating leaks.** Content awaiting admin approval is publicly viewable
   on 4 surfaces. The approval queue does not actually gate visibility.
2. **Admin notification blind spots.** Of ~22 user submission/mutation points,
   only 5 notify the admin (email). The contact form emails no one. The in-app
   notification system (`notifications` table, `createAdminNotification()`,
   bell UI, `/admin/notifications` page, cleanup cron) is fully built but
   **never receives an event** — `createAdminNotification()` has zero call sites.
3. **Polling compute waste.** The admin bell polls the DB every 60 seconds —
   twice in parallel (`NotificationBell.tsx:30` and `AdminLayoutClient.tsx:133`
   each run their own `setInterval`). An open admin tab keeps Neon awake 24/7.

## Verified audit findings

### Approval gating leaks (verified by adversarial re-read of WHERE clauses)

| # | Surface | File | Missing filter |
|---|---------|------|----------------|
| L1 | ATR question detail | `src/app/ask-the-rabbi/[id]/page.tsx` (getQuestion, ~line 35; also generateMetadata and prev/next queries) | `isPublished = true` — page renders unpublished questions; only the comments block checks isPublished |
| L2 | Classified detail | `src/app/classifieds/[id]/page.tsx` (getClassified ~line 42 + generateMetadata) | `approvalStatus = 'approved' AND isActive = true` |
| L3 | Business detail | `src/app/directory/business/[slug]/page.tsx` (~line 95 + generateMetadata) | `approvalStatus = 'approved' AND isActive = true` (the related-businesses query IS filtered) |
| L4 | Directory category browse | `src/app/api/directory/[slug]/route.ts` (~line 91) | `approvalStatus = 'approved'` (has isActive only; the search API has both) |
| L5 | Shiurim list + detail | `src/app/api/shiurim/route.ts` (~line 67), `src/app/api/shiurim/[id]/route.ts` (~line 64) | `approvalStatus = 'approved'` — harmless today (no code path creates pending shiurim) but added as safety net |

Verified-correct (no change needed): blog listing/detail/comments, simchas,
shiva, tehillim, events, kosher alerts, specials, featured businesses,
directory search API, all six query builders in
`src/lib/search/fuzzy-search.ts`.

### Notification coverage matrix (all submission/mutation points)

Tiers (decided with owner):
- **A — Instant email + in-app**: time-sensitive or rare-but-important, pending review
- **B — In-app + daily digest**: routine pending-review items
- **C — In-app FYI only**: content that went live without review (trusted users,
  managers) — awareness, never email

| Content point | Route | Today | Tier |
|---|---|---|---|
| Contact form | `POST /api/contact` | **nothing — saved to DB, emailed to no one** | A |
| Shiva notice (pending) | `POST /api/community/shiva` | email ✔ | A (keep) |
| Kosher alert (pending) | `POST /api/community/kosher-alerts` | nothing | A |
| ATR question | `POST /api/ask-the-rabbi/submit` | email ✔ | A (keep) |
| New business | `POST /api/businesses/create` | nothing | A |
| Shul management request | `POST /api/shuls/request` | nothing | A |
| Non-profit application | `POST /api/businesses/[id]/non-profit` | email ✔ (env var) | A (migrate recipients) |
| Shoutout create | `POST /api/businesses/[id]/shoutouts` | email ✔ (env var) | A (migrate recipients) |
| Shoutout re-submit after rejection | `PATCH /api/businesses/[id]/shoutouts/[shoutoutId]` | nothing | A |
| Event (pending) | `POST /api/community/events` | nothing | B |
| Simcha (pending) | `POST /api/community/simchas` | nothing | B |
| Classified (pending) | `POST /api/community/classifieds` | nothing | B |
| Tehillim (pending) | `POST /api/community/tehillim` | email ✔ | B + keep existing email |
| Blog post (pending) | `POST /api/user/blog`, `PATCH /api/user/blog/[id]` (re-submit) | nothing | B |
| Blog comment (pending) | `POST /api/blog/[slug]/comments` | nothing | B |
| ATR comment (pending) | `POST /api/ask-the-rabbi/[id]/comments` | nothing | B |
| Special/deal (pending) | `POST /api/specials` | nothing | B |
| Business video upload | `POST /api/businesses/[id]/video` | nothing | B |
| Community alert (pending) | `POST /api/community/alerts` | nothing | B |
| Any auto-approved submission (trusted user, all types above) | same routes, auto-approve branch | nothing | C |
| ATR quick-post (manager publishes instantly) | `POST /api/ask-the-rabbi/quick-post` | nothing | C |
| Shul detail edits | `PUT /api/shuls/[id]` | nothing | C |
| Davening schedule create/update/delete | `/api/shuls/[id]/davening[/...]` | nothing | C |
| Shul document upload/update/delete | `/api/shuls/[id]/documents[/...]` | nothing | C |

Out of scope (not content): analytics page-views, newsletter open/click
tracking, PayPal webhooks, notification mark-as-read, classified contact relay
(already relays to the lister).

### Foundation bugs to fix first

| # | Bug | File | Fix |
|---|---|---|---|
| F1 | `formType` accepted as any string — a typo in admin settings silently kills that type's emails | `src/app/api/admin/form-recipients/route.ts` (zod schema) | `z.enum(FORM_TYPES)` |
| F2 | Broadcast batch send has no error handling; partial failures invisible | `src/lib/email/send.ts` (~line 316) | try/catch per batch + log failures |
| F3 | Dual polling | `NotificationBell.tsx`, `AdminLayoutClient.tsx` | removed in Phase 2 |

Note: a previously reported "Resend rejects array `to`" bug was **verified
false** — `resend@6.6.0` types accept `to: string | string[]`.

## Design

### Phase 0 — Make approval actually gate

Fix L1–L5 by adding the missing WHERE conditions (and matching
`generateMetadata` queries). Pending/rejected/unpublished/inactive content
returns `notFound()` on detail pages and is excluded from list APIs.
Fix F1 and F2.

No schema changes. No behavior change for approved content.

### Phase 1 — One notification entry point, wired everywhere

New helper in `src/lib/notifications.ts`:

```ts
notifyAdminOfSubmission({
  contentType: "event" | "classified" | ... ,  // union of all types
  title: string,        // "New event submitted"
  body: string,         // "Lag BaOmer BBQ — by Daniel M."
  linkUrl: string,      // deep link, e.g. "/admin/approvals"
  status: "pending" | "auto_approved",
})
```

Behavior:
1. Always inserts in-app notifications for all active admins (existing
   `createAdminNotification`).
2. Tier A + `pending` → instant email to `formEmailRecipients` rows for that
   type (each type gets its own form_type key; `FORM_TYPES` extended).
3. Tier B/C → in-app only (B items are picked up by the digest, which counts
   pending rows directly — no extra tracking table).
4. Triggers the Pusher event (Phase 2).
5. **Entirely non-fatal**: wrapped so no notification failure can ever break
   the submission itself (`try/catch`, fire-safe — same philosophy as
   `safeQuery`).

Each of the ~24 call sites is a small addition inside the existing route after
the successful insert/update. Existing tehillim/shiva/ATR emails keep working;
non-profit and shoutout emails migrate from `ADMIN_NOTIFICATION_EMAIL` /
`ADMIN_EMAIL` env vars to `formEmailRecipients`.

`FORM_TYPES` grows from 3 to cover every Tier A type plus `daily_digest`. The
admin settings UI already renders types dynamically from the API.

### Phase 2 — Pusher push, polling removed

- Add `pusher` (server) and `pusher-js` (client). Env vars: `PUSHER_APP_ID`,
  `PUSHER_KEY` (+ `NEXT_PUBLIC_PUSHER_KEY`), `PUSHER_SECRET`, `PUSHER_CLUSTER`
  (+ `NEXT_PUBLIC_PUSHER_CLUSTER`).
- Server: `notifyAdminOfSubmission` triggers `admin-notifications` channel,
  event `new-notification` with `{ title, linkUrl }` (no sensitive content in
  the payload; channel is private — auth endpoint verifies admin session).
- Client (bell): fetch unread count **once on mount**, then subscribe; on
  event, increment count locally (no DB read). On bell open, fetch the list
  (one read, user-initiated).
- Delete both `setInterval`s. `AdminLayoutClient` switches from fetching 200
  rows to the existing `/api/admin/notifications/unread-count` endpoint, or
  shares state with the bell component.
- Graceful degradation: if Pusher env vars are absent (e.g. local dev),
  everything still works — just no live updates until refresh.

Result: DB reads happen only on actual page loads and bell opens. Neon
auto-suspends normally. ~10–20 Pusher messages/day ≪ free tier.

### Phase 3 — Daily digest

- New cron in `vercel.json`: `0 13 * * *` (13:00 UTC = 8 AM EST) →
  `/api/cron/notification-digest` (protected by `CRON_SECRET` like existing
  crons).
- Counts pending rows per Tier B type with cheap `count(*)` queries.
- If total = 0 → no email. Otherwise one email to
  `formEmailRecipients(form_type='daily_digest')` recipients:
  "7 items awaiting review: 3 classifieds, 2 blog comments, 2 events" with
  links to each admin tab.
- Note: EST/EDT shift means the email arrives 8 AM or 9 AM depending on
  season; acceptable (matches existing cron conventions).

## Error handling principles

- Notification/email/Pusher failures are logged (`[NOTIFY]` prefix) and never
  propagate to the submitting user.
- Digest cron failures are visible in Vercel cron logs; a failed digest does
  not retry until the next day (acceptable: bell still shows everything).

## Testing / verification

- Phase 0: for each leak, create a pending item, hit the public URL/API →
  expect 404/excluded; approve it → expect visible.
- Phase 1: submit one item per type as a non-trusted user → admin bell shows
  it; Tier A types also produce an email (Resend dashboard); auto-approved
  submission produces FYI only.
- Phase 2: with two browser sessions, submit content in one → bell increments
  in the other without refresh; verify no `setInterval` DB traffic remains.
- Phase 3: with pending items, invoke cron route locally with secret → digest
  email; with zero pending → no email.

## Out of scope (explicit, deferred)

- **Submitter-side notifications** ("your event was approved") — phase 2
  project; same helper supports it later.
- **Audit logging** of shul-manager/owner edits (`logAudit()` exists, unused) —
  noted for a future project.
- Newsletter tracking endpoint hardening (public open/click endpoints) —
  separate security item.
- Caching homepage queries — separate performance item already discussed.
