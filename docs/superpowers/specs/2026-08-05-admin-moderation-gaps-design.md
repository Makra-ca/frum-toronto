# Admin moderation gaps — design

**Date:** 2026-08-05
**Status:** Draft, awaiting approval
**Branch:** one branch covering all three parts

---

## Origin

Two questions from Rochel, sent by WhatsApp on 2026-08-05:

> How do I approve events?
> How do I delete these members that don't sound right?

Both have the same answer: **she can't, because the control does not exist.** The
screenshot of "members that don't sound right" turned out to be a bot signup
wave that has been running unnoticed for at least a week.

This spec covers three fixes and a follow-on verification pass.

---

## Verified findings

Everything below was checked against the repository and the production database
on 2026-08-05. Counts are as of that date.

### 1. Events cannot be approved from anywhere in the admin panel

| Surface | State |
|---|---|
| `EventTable.tsx` | Status is a **read-only badge**. Actions column has Edit and Delete only. |
| `/admin/approvals` | Tabs are **Simchas, Classifieds, Tehillim**. No Events tab. |
| Admin event edit form | `EventForm.tsx` has **no `approvalStatus` field**. |

The backend is not the problem. `POST /api/admin/content/events/[id]/approve`
and `.../reject` both exist, both include `events` in their `typeMap`, and both
route through `setApprovalStatus`. **Nothing in the UI calls them for events** —
the only caller is `approvals-client.tsx`, which passes `"simchas"`,
`"classifieds"` and `"tehillim"` and never `"events"`.

Currently stuck: **5 pending events**, including two Bais Yaakov graduations.

Events is the only content type with this gap. Classifieds, kosher alerts and
blog all have working approve controls. Pending totals across all types:

| Type | Pending |
|---|---|
| events | 5 |
| classifieds | 5 |
| kosher_alerts | 1 |
| blog_posts | 1 |
| everything else | 0 |

### 2. Users cannot be deleted

`/api/admin/users/[id]/route.ts` exports **`PATCH` only**. There is no `DELETE`
endpoint anywhere, and `UserTable.tsx` has no delete control. The only available
action is the **Active** toggle, which blocks sign-in but leaves the row in a
list that is now 3,221 rows long.

### 3. Bot registrations, roughly 10–15 per day

Names are keyboard mash on scraped business addresses — `Sule Nqpowhiuo`,
`Tafbu Tnbmkh`, `Lgqk Kjcdl`, against domains like `makingscience.com` and
`trekronormedia.se`.

| Date | Signups | Unverified |
|---|---|---|
| Aug 5 | 12 | 12 |
| Aug 4 | 15 | 14 |
| Aug 3 | 12 | 10 |
| Aug 2 | 4 | 3 |
| Jul 31 | 7 | 6 |

*(Jul 30 shows 3,126 — that is the legacy import, not signups.)*

`POST /api/auth/register` and `RegisterForm.tsx` have **no captcha, no rate
limit and no honeypot**. Grepped for all three; zero hits.

### 4. "Unverified" is NOT a safe proxy for "bot"

This is the finding that constrains the whole deletion design.

- **81** users are unverified in total.
- **`rochel@frumtoronto.com` (id 9) is unverified and owns 1,395 blog posts.**

A sweep of "all unverified users" would delete the client's own authorship
account and every article attributed to her. (She signs in as
`admin@frumtoronto.com`; id 9 is the import-created account that owns her
content.)

The safe cohort is narrower — unverified **and** created in the last 30 days
**and** owning nothing in any content table: **77 users**.

### 5. The database already blocks unsafe deletes, and silently allows one

Foreign keys referencing `users`:

**`CASCADE`** — removed automatically with the user:
`accounts`, `ask_the_rabbi_comments.author_id`, `email_subscribers`,
`notifications`, `password_reset_tokens`, `sessions`,
`shul_registration_requests.user_id`, `user_shuls.user_id`

**`SET NULL`** — reference cleared, row survives:
`audit_log.actor_id`, `homepage_ads.submitted_by`, `page_views`, `search_queries`

**`NO ACTION`** — the delete **fails** with a foreign-key error:
`alerts`, `ask_the_rabbi_submissions` (×2), `blog_comments.author_id`,
`blog_posts.author_id`, `businesses`, `classifieds`, `community_newsletters`,
`eruv_status`, `events`, `kosher_alerts`, `newsletters`, `shiva_notifications`,
`shul_documents`, `shul_registration_requests.reviewed_by`, `simchas`,
`specials`, `tehillim_list`, `user_shuls.assigned_by`

Two consequences drive the design:

1. **`blog_posts.author_id` and `blog_comments.author_id` are `NOT NULL`.**
   Content in those two tables cannot be orphaned. Deleting such a user requires
   either reassigning the rows or deleting them.
2. **`ask_the_rabbi_comments.author_id` is `NOT NULL` + `CASCADE`.** Deleting a
   user silently destroys their Ask the Rabbi comments in *every* mode, with no
   foreign-key error to stop it. The UI must say so out loud.

### 6. Supporting facts

- **`logAudit()` exists in `src/lib/audit.ts` and has zero callers.** The Audit
  Log page in the sidebar is empty because nothing writes to it.
  `audit_log.actor_id` is `ON DELETE SET NULL` and `actor_email` is a plain
  string, so the trail survives the actor's own deletion.
- **`FrumToronto Archive` (id 3159, `archive@frumtoronto.com`, role `member`)**
  already exists and already owns 283 authorless imported posts. It is the
  established pattern for orphaned content.
- **There is exactly one admin account.** Deleting it locks everyone out.
- The submissions work **is merged to main** (11 files under
  `src/lib/submissions/`), so `pending_edit` and the `isPending()` /
  `PENDING_STATUSES` helpers are available. The note in `CLAUDE.md` claiming it
  is unmerged is stale and should be corrected.
- **The contact form has no spam.** 14 submissions in its entire history, ~1/day,
  all from real people. Turnstile is deliberately **not** applied there.

---

## Part 1 — Event approvals

### `EventTable.tsx`

Add ✓ Approve and ✗ Reject buttons to the Actions column, rendered only when the
event is pending. Use the existing `isPending()` helper rather than
`=== "pending"`, so `pending_edit` (a corrected submission) is covered — a
literal comparison would leave edited events permanently unreachable.

Reject opens a small dialog with an **optional** reason, matching the pattern the
other content types use.

Both call the existing endpoints. Optimistic update on success, revert on error.

### Approvals page

Add an **Events** tab beside Simchas, Classifieds and Tehillim.

- `page.tsx` (server) gains one query for pending events, ordered by
  `start_time` with an `id` tiebreaker.
- `approvals-client.tsx` gains an `events` array, a tab trigger with a count, and
  a tab body reusing the existing card + `handleAction("events", id, action)`.
  `handleAction` already builds the URL generically; **no change to it is
  required**.

### Not in scope

Approve controls for other types. Every other type already has them.

---

## Part 2 — User deletion

### `DELETE /api/admin/users/[id]`

Admin-only. Accepts `?mode=`:

| Mode | Behaviour |
|---|---|
| *(absent)* | **Dry run.** Counts what the user owns across every `NO ACTION` table. Any content → **409 with the inventory**. Nothing is written. |
| `reassign` | `blog_posts.author_id` and `blog_comments.author_id` → **3159**. Every other nullable owner column → `NULL`. Then delete the user. |
| `purge` | Delete the user's rows in the `NO ACTION` tables, then delete the user. |

**Refusals (409, before any write):**

- target `role = 'admin'` — with only one admin account, this is the difference
  between a tidy list and a locked-out client
- target is the caller
- target is **id 3159** (the Archive account) — reassigning content to an account
  that is being deleted is incoherent, and it owns 283 posts

**Every response path writes `logAudit()`** with `action: "DELETE"`,
`entityType: "user"`, the target's email as `entityTitle`, the mode and the
content inventory in `changes`, and the IP from `getIpFromRequest()`.

**No transaction.** `neon-http` does not support them; this is the same
constraint the submissions work documented. Reassign-then-delete is therefore
two round trips. If the delete fails after the reassign, content is already on
the Archive account and the user still exists — recoverable and visible, unlike
the reverse order, which would delete content and then fail to delete the user.
Order is chosen for that reason.

### Delete dialog

Opened from a per-row control. Shows the inventory returned by the dry run, then:

- **Delete user, keep content** → `mode=reassign`
- **Delete user and all their content** → `mode=purge`
- Cancel

**Always shown, in every mode, regardless of inventory:** a warning that the
user's Ask the Rabbi comments will be deleted by the database and cannot be
preserved.

### Multi-select

Checkbox column on `UserTable`, a select-all for the current page, and a bar that
appears when any row is checked.

"Delete selected" runs the **dry run** for each, then presents one combined
dialog: rows with no content are listed as ready, rows with content are listed
separately with their inventory. The two mode buttons apply to the whole
selection. Failures are reported per user, never silently skipped.

### Clear spam signups

A button above the table. Opens a scrollable dialog listing the safe cohort —
**unverified, created within 30 days, owning nothing** — showing **name, email
and join date** per row.

- All rows **ticked** by default
- Any row that owns content is shown **red and unticked** — the cohort query
  should never return one, so this is a second line of defence, not a feature
- Confirm deletes only the ticked rows, via the same endpoint

The 30-day window is fixed for now. Widening it would begin to include the four
older unverified accounts, one of which is Rochel's.

### Deletion is permanent

The row is removed. The Audit Log is the record of who deleted whom and when.

---

## Part 3 — Cloudflare Turnstile on registration

### Why Turnstile

Free plan: **20 widgets per account, 10 hostnames per widget, unlimited
verification requests.** The site's DNS does not need to be on Cloudflare. One
account therefore covers up to 20 client sites, which matters beyond this
project.

### Implementation

- `RegisterForm.tsx` renders the widget and submits its token with the form.
- `POST /api/auth/register` verifies the token against
  `https://challenges.cloudflare.com/turnstile/v0/siteverify` **before any
  database read or write**, including before the existing-user lookup — so the
  endpoint cannot be used to probe which addresses are registered.
- Env: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, added to
  `.env.example` so the requirement is discoverable.

**Missing-secret behaviour:** fail **closed** in production, **open** in
development. A silent pass in production would mean the protection is off and
nothing says so; a hard failure in development would block local work and every
existing test that posts to the register route.

### Rate limit

A per-IP signup cap alongside Turnstile, since tokens can be farmed. The repo has
no rate-limiting utility today, so this introduces one. Storage mechanism is an
open question — see below.

### Deliberately excluded

**The contact form.** 14 submissions ever, all genuine, no spam. Adding a
challenge to a form real community members use once a day, to block spam that is
not occurring, is a bad trade. Trivial to add later.

---

## Part 4 — Admin walkthrough *(after this branch merges)*

The events gap survived months of work because verification has been grep and SQL
against route handlers — *does this endpoint behave correctly* — and never *can a
human reach this endpoint*. The admin surface has never been exercised in a
browser by anyone but Rochel, and `CLAUDE.md` records that limitation four times
without ever escalating it.

With a local dev admin account, walk every admin screen performing the real jobs
— approve, reject, edit, delete, create — and record every dead end. That list
becomes the next spec.

---

## Testing

**Part 1**
- `isPending()` is used, not `=== "pending"` — a `pending_edit` event shows
  buttons
- Approving a pending event sets `approved` and broadcasts
- Approving an event whose `broadcast_at` is already set does **not** re-broadcast
- Approving from `pending_edit` does **not** broadcast

**Part 2**
- Dry run returns 409 with an accurate inventory for a user with content
- Dry run permits deletion for a user with none
- `reassign` moves blog posts to 3159 and leaves them publicly visible
- `purge` removes the content
- Deleting an admin, oneself, or id 3159 is refused
- Every path writes an audit row, including refusals
- The spam cohort query **excludes id 9** — a direct regression test against
  the Rochel case, which is the whole reason the cohort is defined this way

**Part 3**
- Registration without a token is rejected
- Registration with an invalid token is rejected
- Rejection happens **before** the existing-user lookup (no address probing)
- Missing secret fails closed with `NODE_ENV=production`, open otherwise

---

## Open questions

1. **Cloudflare keys.** Build Part 3 with verification wired and keys added
   later? Registration stays unprotected until they land, but nothing breaks.
2. **Rate-limit storage.** No utility exists. In-memory is useless on serverless
   (per-instance, reset constantly); the options are a database table or an
   external store. Needs a decision before Part 3 is implemented.

---

## Out of scope, recorded so they are not lost

From the contact form, two genuine user reports:

- **Two separate people** are asking for the monthly zmanim calendar the old site
  had.
- One report that **password reset emails are not arriving**.

Also unresolved from earlier sessions: **12 commits on `main` are unpushed**, so
some already-completed fixes are not live.
