# Admin Notification Coverage & Approval Gating — Design Spec

**Date:** 2026-06-07 (rev 2 after adversarial verification + spec review)
**Status:** Approved by owner (design discussion 2026-06-06/07)

## Problem

A full audit of the site found three related problems:

1. **Approval gating leaks.** Content awaiting admin approval is publicly viewable
   on 4 surfaces. The approval queue does not actually gate visibility.
2. **Admin notification blind spots.** Of ~24 user submission/mutation points,
   only 5 notify the admin (email). The contact form emails no one. The in-app
   notification system (`notifications` table, `createAdminNotification()`,
   bell UI, `/admin/notifications` page, cleanup cron) is fully built but
   **never receives an event** — `createAdminNotification()` has zero call sites.
3. **Polling compute waste.** The admin bell polls the DB every 60 seconds —
   twice in parallel (`src/components/notifications/NotificationBell.tsx:30`
   and `src/components/admin/AdminLayoutClient.tsx:133` each run their own
   `setInterval`). An open admin tab keeps Neon awake 24/7.

## Verified audit findings

### Approval gating leaks (verified by adversarial re-read of WHERE clauses)

| # | Surface | File | Missing filter | Preview constraint |
|---|---------|------|----------------|--------------------|
| L1 | ATR question detail | `src/app/ask-the-rabbi/[id]/page.tsx` — getQuestion (line ~34), generateMetadata (~16), prev/next nav queries (~44, ~51) | `isPublished = true` | **ATR dashboard previews drafts via this page** (`dashboard/ask-the-rabbi/page.tsx:409` links `/ask-the-rabbi/{id}`). Needs admin/manager bypass. |
| L2 | Classified detail | `src/app/classifieds/[id]/page.tsx` — getClassified (~43), generateMetadata (~26) | `approvalStatus = 'approved' AND isActive = true` | No dashboard preview links found. Blanket filter safe. |
| L3 | Business detail | `src/app/directory/business/[slug]/page.tsx` — main query (~95), generateMetadata (~76) | `approvalStatus = 'approved' AND isActive = true` (related-businesses query at ~235 IS filtered) | **Owner dashboard has "View Public Listing" button for pending businesses** (`dashboard/business/[id]/page.tsx:210`). Needs owner/admin bypass. |
| L4 | Directory category browse | `src/app/api/directory/[slug]/route.ts` — conditions array (~91) | `approvalStatus = 'approved'` (has isActive only; the search API has both) | n/a (list API) |
| L5 | Shiurim list + detail | `src/app/api/shiurim/route.ts` (~67), `src/app/api/shiurim/[id]/route.ts` (~64) | `approvalStatus = 'approved'` — harmless today (no code path creates pending shiurim; schema default is "approved") but added as safety net | n/a |

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
| Community alert (pending; `alerts` table) | `POST /api/community/alerts` | nothing | B |
| Any auto-approved submission (trusted user, all types above) | same routes, auto-approve branch | nothing | C |
| ATR quick-post (manager publishes instantly) | `POST /api/ask-the-rabbi/quick-post` | nothing | C |
| Shul detail edits | `PUT /api/shuls/[id]` | nothing | C |
| Davening schedule create/update/delete | `/api/shuls/[id]/davening[/...]` | nothing | C |
| Shul document upload/update/delete | `/api/shuls/[id]/documents[/...]` | nothing | C |

**Tier C noise rule:** one notification per HTTP request (one save action), never
per row. Davening/document edits are low-volume; no debouncing in v1. If a shul
manager's edit session proves noisy in practice, add per-shul debouncing later.

Out of scope (not content): analytics page-views, newsletter open/click
tracking, PayPal webhooks, notification mark-as-read, classified contact relay
(already relays to the lister).

### Foundation bugs to fix first

| # | Bug | File | Fix |
|---|---|---|---|
| F1 | `formType` accepted as any string — a typo in admin settings silently kills that type's emails | `src/app/api/admin/form-recipients/route.ts` (zod schema, line ~19) | `z.enum(FORM_TYPES)` |
| F2 | Broadcast batch send has no error handling; partial failures invisible | `src/lib/email/send.ts` (~line 316) | try/catch per batch + log failures |
| F3 | Dual polling | `src/components/notifications/NotificationBell.tsx:30`, `src/components/admin/AdminLayoutClient.tsx:133` | removed in Phase 2 |

Notes from verification:
- A previously reported "Resend rejects array `to`" bug was **verified false** —
  `resend@6.6.0` types accept `to: string | string[]`.
- `FORM_TYPES` currently has **6** entries (`ask_the_rabbi`, `contact_form`,
  `business_registration`, `shul_registration`, `event_submission`,
  `classified_submission`) — but only 3 are ever looked up by routes. The
  contact form, business, and shul form types exist in config yet their routes
  never query recipients. Phase 1 wires them.

## Design

### Phase 0 — Make approval actually gate

Fix L1–L5 by adding the missing WHERE conditions (and matching
`generateMetadata` + prev/next queries). Pending/rejected/unpublished/inactive
content returns `notFound()` on detail pages and is excluded from list APIs —
**except** for authorized previews:

- **L1 (ATR detail):** unpublished question renders only if the session user is
  admin or has `canManageAskTheRabbi`. Implementation: query without the filter,
  then `if (!q.isPublished && !authorizedPreview) notFound()`. Prev/next nav and
  generateMetadata get the blanket `isPublished` filter (preview pages may show
  default metadata; acceptable).
- **L3 (business detail):** non-approved/inactive business renders only if
  session user is admin or the business owner (`businesses.userId === session
  user id`). Same post-query check pattern. generateMetadata gets the blanket
  filter.
- **L2, L4, L5:** blanket filters (verified: no preview flows exist).
- Optional polish (in scope, small): when rendering an authorized preview, show
  a slim "Pending approval — only you can see this" banner.

Fix F1 and F2. No schema changes. No behavior change for approved content.

### Phase 1 — One notification entry point, wired everywhere

New helper in `src/lib/notifications.ts`:

```ts
type SubmissionContentType =
  | "contact_form" | "shiva" | "kosher_alert" | "ask_the_rabbi"
  | "business" | "shul_request" | "non_profit" | "shoutout"          // Tier A
  | "event" | "simcha" | "classified" | "tehillim" | "blog_post"
  | "blog_comment" | "atr_comment" | "special" | "business_video"
  | "community_alert"                                                 // Tier B
  | "atr_quick_post" | "shul_edit" | "davening_edit" | "shul_document"; // Tier C-only

notifyAdminOfSubmission({
  contentType: SubmissionContentType,
  title: string,        // "New event submitted"
  body: string,         // "Lag BaOmer BBQ — by Daniel M."
  linkUrl: string,      // deep link, e.g. "/admin/approvals"
  status: "pending" | "auto_approved",
})
```

`contentType` and `status` are **routing parameters only** — they select the
tier and email recipients. They are NOT persisted; the `notifications` table
schema is unchanged (`type` column stores the contentType string for display
grouping, which it already supports).

Behavior:
1. Always inserts in-app notifications for all active admins (existing
   `createAdminNotification`).
2. Tier A + `pending` → instant email to `formEmailRecipients` rows for that
   type. `status: "auto_approved"` is always Tier C regardless of contentType.
3. Tier B/C → in-app only (B items are picked up by the digest, which counts
   pending rows directly — no extra tracking table).
4. Triggers the Pusher event (Phase 2).
5. **Entirely non-fatal**: wrapped so no notification failure can ever break
   the submission itself (`try/catch`, fire-safe — same philosophy as
   `safeQuery`).

`FORM_TYPES` mapping:
- Existing keys reused: `ask_the_rabbi`, `contact_form`,
  `business_registration` (→ `business`), `shul_registration`
  (→ `shul_request`), plus existing shiva/tehillim lookups already done
  in-route move into the helper.
- New keys added: `kosher_alert`, `non_profit`, `shoutout`, `daily_digest`.
- `event_submission` and `classified_submission` remain in `FORM_TYPES` (those
  types are Tier B → no instant email). During migration, any recipient rows
  configured under them are copied into `daily_digest` (dedup by email) so
  intent ("I want to hear about events") is preserved.
- The admin settings UI already renders form types dynamically from the API —
  no UI change beyond the enum growing.

Each of the ~24 call sites is a small addition inside the existing route after
the successful insert/update. Existing tehillim/shiva/ATR emails keep working
(refactored through the helper); non-profit and shoutout emails migrate from
`ADMIN_NOTIFICATION_EMAIL` / `ADMIN_EMAIL` env vars to `formEmailRecipients`.

### Phase 2 — Pusher push, polling removed

- Add `pusher` (server) and `pusher-js` (client). Env vars: `PUSHER_APP_ID`,
  `PUSHER_SECRET`, `PUSHER_KEY` + `NEXT_PUBLIC_PUSHER_KEY`,
  `PUSHER_CLUSTER` + `NEXT_PUBLIC_PUSHER_CLUSTER`.
- New `src/lib/pusher.ts`: lazy server client; no-op when env vars absent.
- **Channel:** single shared private channel `private-admin-notifications`
  (Pusher requires the `private-` prefix). All admins subscribe to the same
  channel; events carry no sensitive payload (`{ title, linkUrl }` only — body
  is fetched from the DB when the bell opens).
- **Auth endpoint:** new `POST /api/pusher/auth` —
  NOT covered by the middleware matcher (`/admin/:path*`, `/dashboard/:path*`),
  so it MUST call `auth()` explicitly, verify `role === "admin"`, then return
  `pusher.authorizeChannel(socket_id, channel_name)`. Reject any channel name
  other than `private-admin-notifications`.
- Server: `notifyAdminOfSubmission` triggers event `new-notification` after the
  DB insert.
- Client: new hook `usePusherNotifications` (subscribe/cleanup). The bell
  fetches unread count **once on mount** (existing
  `/api/admin/notifications/unread-count`), then increments locally on events.
  Opening the bell fetches the list (one read, user-initiated).
- **Single count source:** delete BOTH `setInterval`s. `AdminLayoutClient`'s
  independent fetch is removed entirely; the unread count state is lifted so
  the sidebar badge and header bell share one source (one fetch on mount + one
  Pusher subscription total).
- Graceful degradation: if Pusher env vars are absent (local dev), everything
  works minus live updates — count refreshes on page navigation.

Result: DB reads happen only on actual page loads and bell opens. Neon
auto-suspends normally. ~10–20 Pusher messages/day ≪ free tier (200k/day).

### Phase 3 — Daily digest

- New cron in `vercel.json`: `0 13 * * *` (13:00 UTC = 8 AM EST) →
  `/api/cron/notification-digest` (protected by `CRON_SECRET` like existing
  crons).
- Counts pending rows per Tier B type with cheap `count(*)` queries
  (all Tier B types verified to have queryable pending state, incl.
  `businesses.videoApprovalStatus = 'pending'` and `alerts.approvalStatus`).
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

- Phase 0: for each leak, create a pending item, hit the public URL/API
  logged-out → expect 404/excluded; as owner/ATR-manager → expect preview
  works; approve it → publicly visible.
- Phase 1: submit one item per type as a non-trusted user → admin bell shows
  it; Tier A types also produce an email (Resend dashboard); auto-approved
  submission produces FYI only.
- Phase 2: with two browser sessions, submit content in one → bell increments
  in the other without refresh; verify no `setInterval` DB traffic remains.
- Phase 3: with pending items, invoke cron route locally with secret → digest
  email; with zero pending → no email.

## Out of scope (explicit, deferred)

- **Submitter-side notifications** ("your event was approved") — follow-up
  project; same helper supports it later. (User-side notification page
  `/dashboard/notifications` + `/api/user/notifications` already exist.)
- **Audit logging** of shul-manager/owner edits (`logAudit()` in
  `src/lib/audit.ts` exists, unused) — noted for a future project.
- Pusher events for regular users — admin channel only in v1.
- Newsletter tracking endpoint hardening (public open/click endpoints) —
  separate security item.
- Caching homepage queries — separate performance item already discussed.
