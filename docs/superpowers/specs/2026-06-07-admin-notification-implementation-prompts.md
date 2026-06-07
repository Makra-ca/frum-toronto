# Implementation prompts — Admin Notification Coverage project

Paste one prompt per fresh Claude session, in order. Each phase is committed
separately so the reviewing session can audit clean diffs. The spec is the
source of truth: `docs/superpowers/specs/2026-06-07-admin-notification-coverage-design.md`.

---

## Prompt 1 — Phase 0: Approval gating fixes

```
Read docs/superpowers/specs/2026-06-07-admin-notification-coverage-design.md fully, then implement ONLY Phase 0 (approval gating fixes L1–L5 + foundation bugs F1–F2). Do not start Phase 1.

Key requirements from the spec:
- L1 (src/app/ask-the-rabbi/[id]/page.tsx): unpublished questions return notFound() UNLESS session user is admin or has canManageAskTheRabbi (post-query check, not WHERE clause). Blanket isPublished filter on generateMetadata and the prev/next navigation queries. Also add a "Preview" link for unpublished questions in the ATR dashboard table (src/app/(dashboard)/dashboard/ask-the-rabbi/page.tsx — the existing view link at ~line 408 only renders when isPublished).
- L2 (src/app/classifieds/[id]/page.tsx): blanket approvalStatus='approved' AND isActive=true on both getClassified and generateMetadata. No bypass needed.
- L3 (src/app/directory/business/[slug]/page.tsx): non-approved/inactive business returns notFound() UNLESS session user is admin or the owner (businesses.userId === session user id). Blanket filter on generateMetadata.
- L1+L3 polish: when rendering an authorized preview of pending content, show a slim "Pending approval — only visible to you" banner.
- L4 (src/app/api/directory/[slug]/route.ts ~line 91): add eq(businesses.approvalStatus, "approved") to the conditions array.
- L5 (src/app/api/shiurim/route.ts ~line 67 and src/app/api/shiurim/[id]/route.ts ~line 64): add eq(shiurim.approvalStatus, "approved").
- F1 (src/app/api/admin/form-recipients/route.ts ~line 19): formType validation becomes z.enum over the FORM_TYPES constant (do NOT add new form types yet — that's Phase 1).
- F2 (src/lib/email/send.ts ~line 316): wrap each resend.batch.send batch in try/catch, log failures with batch index, continue remaining batches.

Constraints:
- Read each target file before editing; verify the quoted line numbers still match.
- Do not change behavior for approved/published content.
- Do not run build or typecheck (owner verifies).
- Verify your work by reading back each WHERE clause / check you added.
- Commit when done as: "fix: enforce approval gating on public detail pages and list APIs"
- Commit message must NOT contain any Claude/AI attribution.
```

---

## Prompt 2 — Phase 1: Notification wiring

```
Read docs/superpowers/specs/2026-06-07-admin-notification-coverage-design.md fully, then implement ONLY Phase 1 (notification entry point + wiring all routes). Phases 0 is already done; do not start Phase 2 (skip the Pusher trigger — leave a clearly marked stub/TODO where the spec says the Pusher event fires).

Build exactly to the spec's Phase 1 section:
1. In src/lib/notifications.ts add notifyAdminOfSubmission() with the SubmissionContentType union and tier mapping exactly as the spec enumerates. contentType/status are routing params only — NO schema changes. status "auto_approved" is always Tier C.
2. Tier A + pending → instant email via formEmailRecipients lookup. Extend FORM_TYPES in src/app/api/admin/form-recipients/route.ts with the new keys per spec (kosher_alert, non_profit, shoutout, daily_digest). Reuse existing keys per the spec's mapping table.
3. Migrate non-profit and shoutout routes off ADMIN_NOTIFICATION_EMAIL/ADMIN_EMAIL env vars to formEmailRecipients. Write a small migration script (scripts/) that copies any event_submission/classified_submission recipient rows into daily_digest rows (dedup by email) — do not run it, just create it.
4. Refactor the three existing in-route email sends (ATR submit, shiva, tehillim) to go through the helper so behavior is identical but centralized.
5. Wire ALL submission points in the spec's coverage matrix (~24 call sites, Tier A/B/C). One notification per HTTP request. Every call wrapped so notification failure can never break the submission (the helper itself must be fully try/caught and log with [NOTIFY] prefix).
6. Generic admin-notification email template consistent with existing templates in src/lib/email/templates.ts (table layout, inline CSS, new Date().getFullYear() for copyright).

Constraints:
- Read every route before editing it; place the call AFTER the successful DB insert/update.
- Emails must be awaited (serverless) but inside the helper's try/catch.
- Do not run build or typecheck.
- Commit as: "feat: admin notifications for all user submission points"
- No Claude/AI attribution in the commit message.
```

---

## Prompt 3 — Phase 2: Pusher + remove polling

```
Read docs/superpowers/specs/2026-06-07-admin-notification-coverage-design.md fully, then implement ONLY Phase 2 (Pusher push, polling removal). Phases 0–1 are done.

FIRST: check .env / .env.local for PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER, NEXT_PUBLIC_PUSHER_KEY, NEXT_PUBLIC_PUSHER_CLUSTER. If missing, STOP and ask me to create a free Pusher Channels app and provide them before writing code.

Build exactly to the spec's Phase 2 section:
1. npm install pusher pusher-js.
2. src/lib/pusher.ts — lazy server client, no-op when env vars absent (graceful degradation, app must work without Pusher).
3. POST /api/pusher/auth — explicit auth() call (middleware does NOT cover /api/pusher), require role === "admin", reject any channel_name other than "private-admin-notifications", return pusher.authorizeChannel(socket_id, channel_name).
4. Replace the Phase 1 stub in notifyAdminOfSubmission: trigger event "new-notification" on channel "private-admin-notifications" with payload { title, linkUrl } only (no body content).
5. Client hook usePusherNotifications (src/hooks/) — subscribe/unsubscribe lifecycle, increments count on event.
6. NotificationBell (src/components/notifications/NotificationBell.tsx): fetch unread count ONCE on mount via /api/admin/notifications/unread-count, subscribe via the hook, DELETE the setInterval at ~line 30. Opening the bell fetches the list as today.
7. AdminLayoutClient (src/components/admin/AdminLayoutClient.tsx): DELETE its independent fetch + setInterval at ~line 133 entirely. Lift the unread count state so the sidebar badge and header bell share ONE source (one fetch on mount + one subscription total).
8. Add the new env vars to .env.example with comments.

Verification: grep the repo to confirm zero remaining setInterval polling of notification endpoints.

Constraints: do not run build or typecheck. Commit as: "feat: real-time admin notifications via Pusher, remove polling". No Claude/AI attribution.
```

---

## Prompt 4 — Phase 3: Daily digest cron

```
Read docs/superpowers/specs/2026-06-07-admin-notification-coverage-design.md fully, then implement ONLY Phase 3 (daily digest). Phases 0–2 are done.

Build exactly to the spec's Phase 3 section:
1. /api/cron/notification-digest route — protect with CRON_SECRET bearer check identical to the existing crons (see src/app/api/cron/cleanup-notifications/route.ts for the pattern).
2. count(*) per Tier B type from the spec matrix: events, simchas, classifieds, tehillim, blog posts, blog comments, ATR comments, specials, community alerts (the `alerts` table), business videos (businesses.videoApprovalStatus = 'pending'). Pending = approvalStatus 'pending' (+ isActive where applicable — match each table's conventions by reading the schema).
3. Total 0 → return early, send nothing. Otherwise ONE email to formEmailRecipients(form_type='daily_digest') recipients listing each nonzero type with its count and a deep link to the right admin page (check the admin sidebar routes: /admin/approvals, /admin/programs/*, /admin/community/*).
4. Email template: table-based, inline CSS, consistent with existing templates, dynamic copyright year.
5. Add cron entry to vercel.json: "0 13 * * *" (8 AM EST).

Verification: list each Tier B table's exact WHERE clause you used and double-check against src/lib/db/schema.ts column names before finishing.

Constraints: do not run build or typecheck. Commit as: "feat: daily admin digest email for pending approvals". No Claude/AI attribution.
```

---

## Review protocol (for the reviewing session)

After each phase, return to the review session and say "review phase N".
Reviewer checks `git diff HEAD~1` against the spec section, hunting for:
missed call sites, broken preview flows, notification failures that could
propagate to users, WHERE clauses on wrong columns, polling reintroduced.
