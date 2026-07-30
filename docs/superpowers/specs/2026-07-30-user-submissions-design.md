# User submissions: view, edit, and hear back

**Date:** 2026-07-30
**Status:** approved after review; not yet implemented (events partially built — see *Current state*)
**Revision:** 2 — rewritten after an adversarial review found a critical broadcast defect and a false claim
about the blog. See *Review findings* for what changed and why.

## Problem

A user who submits content to FrumToronto mostly cannot see it again, change it, or withdraw it, and is
never told the outcome.

The consequences land on the admin:

- Any correction becomes an email. This spec exists because of one: a school secretary wrote in asking to
  change a graduation date, saying *"I didn't know how to edit an existing booking, so I added it as a new
  one."* She was not confused — for events there genuinely is no way.
- Someone who cannot edit resubmits, so the admin gets duplicates and must work out which is current.
- Nobody learns the outcome, so "did you get my event?" and "is it up yet?" are recurring support load.

Blog is the exception and the proof: it already has `/dashboard/blog` and `PATCH /api/user/blog/[id]`, and
generates none of this.

## Decisions

| Decision | Choice |
|---|---|
| Structure | **One list** at `/dashboard/submissions`, all types together |
| Editing an approved item | **Unpublished and re-reviewed**, via a distinct `pending_edit` status |
| Blog's conflicting rule | **Blog adopts the unpublish rule**; one policy everywhere |
| Auto-approvers and admins | **Their edits stay live**, admin notified in-app — see *Auto-approve* |
| Shul-linked content | **Editable by whoever currently manages the shul**, not only the poster |
| Notification channel | **Email on approve and reject, plus an in-app record** |
| Rejection reason | **Optional**, with written fallback copy when blank |
| Email opt-out | **None — transactional** (CASL: consent not required, identification still is) |
| Old items | **Active by default, past behind a toggle** |
| Scope | **All content types** except those listed under *Out of scope* |

Costs accepted deliberately:

- **Unpublishing on edit** takes a live item off the site until an admin acts. Mitigated by warning in the
  form before saving — never by changing the rule.
- **An optional rejection reason** means the blank path is what a busy admin will take. Mitigated by writing
  the fallback copy so it reads deliberate rather than as a shrug.
- **Changing blog's rule** touches working code that 3,058 posts depend on. Mitigated by doing blog last,
  after the pattern is proven elsewhere.

## The broadcast defect that shapes the design

Approving does not merely flip a status — it broadcasts. Verified:

```ts
// src/app/api/admin/content/[type]/[id]/approve/route.ts:72
if (type === "events" && previousApprovalStatus !== "approved") {
  await sendEventLiveEmail(approvedEvent);   // every subscriber with communityEvents = true
}
```

The same shape exists in `admin/shiva/[id]` and `admin/kosher-alerts/[id]`.

A naive design where an edit sets `pending` means: approved → user fixes a typo → `pending` → admin
re-approves → the guard sees a non-approved previous status and **re-broadcasts to the entire subscriber
list**. For shiva that is re-sending a bereavement notice to the whole community because someone corrected a
street address.

**Therefore an edit sets `pending_edit`, not `pending`.** Every broadcast guard fires only on
`pending → approved`. Re-approving a `pending_edit` item notifies the submitter and nobody else.

This also earns something useful: the approvals queue can distinguish new submissions from corrections.

## Auto-approve

Twelve `canAutoApprove*` columns exist on `users`. A holder's submission goes live on create
(`community/events/route.ts:83-90`).

The already-merged `applyEventEdit` sets `pending` unconditionally, so today **an admin or trusted user who
edits their own live event self-unpublishes it** and must ask someone else to restore it. The permission
means "your posts go live without review"; the edit path silently revokes it. `applyEventEdit` does not even
load the user row, so it cannot know.

**Rule:** the edit path re-runs the same determination the create path runs — admin OR
`canAutoApprove<Type>` — and only falls back to `pending_edit` when that does not hold. The determination
lives in one shared helper used by both create and edit, per type, so they cannot drift.

**Their edits stay live, and the admin is notified.** The permission means "posts go live without review",
so corrections behave the same way; anything less self-unpublishes admins. The residual risk is that a
trusted user could publish something innocuous and later edit it to anything, unreviewed. Mitigated by an
in-app notification (not an email) whenever an auto-approver edits already-public content, so there is a
trail without adding inbox noise. The flag is granted and revoked by an admin.

## State machine

| From | Trigger | To | Broadcast? | Notified |
|---|---|---|---|---|
| — | user submits | `pending` | — | admin |
| — | auto-approver submits | `approved` | **yes** | admin (FYI) |
| `pending` | admin approves | `approved` | **yes** | user: email + in-app |
| `pending` | admin rejects | `rejected` | no | user: email + in-app, reason if given |
| `approved` | user edits | `pending_edit`, unpublished | no | admin |
| `approved` | auto-approver edits | `approved`, stays live | **no** | admin (FYI) |
| `pending_edit` | admin approves | `approved` | **no** | user: email + in-app |
| `pending` / `rejected` | user edits | unchanged / `pending` | no | admin |

The user is emailed about the admin's actions, never their own.

## Ownership is the binding constraint

Only rows carrying an owner column can ever be shown or edited. Measured on production, 2026-07-30:

| Type | Owner col | Owned | Total | Notes |
|---|---|---|---|---|
| **blog_posts** | `author_id` | **3,058** | 3,058 | already has edit; rule differs — see below |
| classifieds | `user_id` | 10 | 1,670 | |
| simchas | `user_id` | 9 | 16,551 | `event_date` is a DATE |
| events | `user_id` | 6 | 94 | |
| kosher_alerts | `user_id` | 1 | 1,588 | |
| alerts | `user_id` | 1 | 1 | |
| shiva_notifications | `user_id` | 1 | 1 | most sensitive content on the site |
| tehillim_list | `user_id` | 2 | 2 | has delete, no edit |
| ask_the_rabbi_submissions | `user_id` | 1 | 1 | see below |

Everything else is legacy import with a NULL owner, permanently invisible to this feature. That is correct
— those rows have no submitter who could own them.

**Blog dwarfs everything else combined** and already works. Its existing rule is the opposite of this design:
`user/blog/[id]/route.ts:120` refuses to edit anything not `pending` or `rejected`. Per the decision above
blog adopts the unpublish rule, but it is sequenced **last** so the pattern is proven on smaller types first.

### Out of scope

- **`specials`** — no public submission API exists (only admin routes and a read-only GET), and 0 of 3 rows
  are owned. There is nothing to edit and no way for a user to create one. Build the submission path first
  if this is wanted.
- **`shiurim`** — no owner column at all. Needs a `user_id` migration; existing rows can never be attributed.
- **`ask_the_rabbi`** (published) — not owned, and questions are *answered*, not approved.
  `ask_the_rabbi_submissions` **is** owned and has a `status`, so a *pending* question could be editable.
  Deliberately deferred: a question that has been answered must not be rewritable, and that needs its own
  design.

## Components

### `/dashboard/submissions`

One list, all types, newest first. Type chip, status chip, and a colour stripe on the left edge so state is
scannable without reading labels.

Reader-facing status wording: **On the calendar** / **Published**, **Awaiting approval**, **Awaiting
re-approval**, **Not approved**. A rejected row shows the reason and offers **Edit & resubmit**.

Past items collapse behind a *Show past submissions* toggle.

### `GET /api/user/submissions`

```ts
interface Submission {
  id: number;
  type: SubmissionType;            // union, NOT string — keeps exhaustiveness
  typeLabel: string;
  title: string;
  detail: string | null;
  detailKind: "instant" | "date";  // REQUIRED — see below
  approvalStatus: "pending" | "pending_edit" | "approved" | "rejected";
  rejectionReason: string | null;
  isPast: boolean;
  canEdit: boolean;                // per-type rules, not inferred from status by the page
  createdAt: string | null;
  editHref: string | null;
  publicHref: string | null;
}
```

**`detailKind` is not optional.** `src/lib/datetime.ts` documents that `date` columns must render through
`formatDateOnly` and `timestamp` columns through `formatInstant`; using the wrong one shifts a date-only
value back a day. `simchas.event_date` and `shiva_notifications.shiva_end` are DATE columns, `events.start_time`
is a timestamp. A single `detail` field with no discriminator would display every simcha a day early — the
exact defect fixed on 2026-07-30.

**`isPast` is defined per type**, because four types have no meaningful expiry:

| Type | Basis | NULL / undated |
|---|---|---|
| events | `start_time` in the past | — |
| shiva_notifications | `shiva_end` before today | NOT NULL |
| classifieds, alerts | `expires_at` passed | NULL ⇒ **not past** |
| tehillim_list | `expires_at` passed, unless `is_permanent` | permanent ⇒ **not past** |
| simchas, kosher_alerts, blog_posts | no expiry concept | always **not past** |

Undated items are never past, so nothing can silently disappear behind the toggle.

### `PATCH /api/community/<type>/[id]`

One route per type, each delegating to a small testable module (see the built
`lib/events/edit-submission.ts`). Every one must:

1. reject unauthenticated callers (401);
2. run `assertCanPost` — the same verified-and-not-blocked gate as creating;
3. reject non-owners, treating a NULL owner as unowned (403);
4. apply a **field whitelist** so a client cannot reassign the owner or self-approve;
5. resolve the next status via the shared auto-approve helper (`approved` or `pending_edit`);
6. write conditionally on the status read in step 3 and return **409** if zero rows match.

Step 6 is the concurrency guard. Only `blog_posts` has an `updated_at`; events, simchas, classifieds,
kosher_alerts and shiva do not. Without it, a user editing while an admin approves is last-write-wins, which
can publish unreviewed content. Add `updated_at` per type as part of this work and order the admin queues by
it, so an edited 2023 item resurfaces at the top of the queue instead of sinking to the bottom.

### `setApprovalStatus()` — one writer

Roughly fifteen call sites currently flip `approval_status`: the shared
`admin/content/[type]/[id]/approve` and `.../reject`, plus per-type PATCH routes for events, simchas, shiva,
kosher-alerts, tehillim, classifieds and specials.

Naming this as a risk is not a design. **All of them must be refactored onto a single helper** that owns:

- the transition detection (`pending → approved` vs `pending_edit → approved`);
- the broadcast decision;
- the submitter notification.

Anything left off the helper silently notifies nobody, or silently re-broadcasts.

### `notifySubmitter()`

Beside the existing `notifyAdminOfSubmission()`. Note the real signature is
`createNotification(payload)` — a single object of `{ userId, type, title, body?, linkUrl? }`, not positional
arguments.

The in-app `type` must be **`content_approved`** or **`content_rejected`**; `dashboard/notifications/page.tsx`
switches on those strings and falls through to a plain grey bell for anything else.

Wrapped in try/catch with a `[NOTIFY]` prefix: a failed email must never fail an approval.

### Emails

Two transactional templates linking to `/dashboard/submissions`: **approved** (name, date via the correct
formatter, link to the live page) and **not approved** (reason or fallback, resubmit link). Standard footer
identification, no unsubscribe link.

### Admin

An optional reason box in the reject dialog, writing to a `rejection_reason` column per type — matching
`homepage_ads.rejection_reason` and `businesses.video_rejection_reason`.

*Considered and rejected:* a shared `submission_reviews` table. It would suit the single-writer requirement,
but it is a larger refactor than this feature needs and diverges from two existing patterns.

## Ownership is institutional where a shul is involved

Content linked to a shul is editable by **the owner OR anyone currently assigned to that shul** in
`user_shuls`. `events.shul_id` already exists and the create path already runs `canUserManageShul`, so the
check is available; the edit path must run it too.

Personal-only ownership was rejected because it produces the case most likely to generate a support email: a
gabbai leaves, the new one cannot fix the shul's own event, and the departed one still can.

The ownership check per type is therefore:

```
owner(row) = row.<ownerCol> === userId
           || (row.shulId != null && canUserManageShul(userId, row.shulId, role))
```

Businesses are **not** included yet — no in-scope type carries a `business_id`. When one does, the same
shape applies.

## Blocked and deleted owners

`assertCanPost` re-checks `is_active`, so a blocked user cannot edit — verified, not a gap. An
already-approved item from a since-blocked user stays live; taking it down is an admin action, not an
automatic one, and this spec takes no further position.

Owner columns have no `ON DELETE` clause, so deleting a user would fail at the foreign key. No admin
user-delete route exists today, so this is latent rather than live.

## Build order

Cut from the tail if it drags; nothing later is a prerequisite for anything earlier.

1. **Shared foundations** — `pending_edit`, `setApprovalStatus()`, the auto-approve helper, `updated_at`,
   `notifySubmitter()`, both email templates. *Nothing else works until this is right.*
2. **events** — mostly built; fix the auto-approve bug and the `detailKind` gap
3. **classifieds, simchas** — what ordinary people post
4. **kosher_alerts, alerts, tehillim_list**
5. **shiva_notifications** — in scope under the same rule, decided deliberately. Two mitigations are
   required rather than optional: the edit form carries a **stronger, shiva-specific warning** than other
   types, because a notice disappearing mid-shiva is the sharpest form of the unpublish trade-off; and
   re-approval of a `pending_edit` shiva notice must not re-send `sendShivaNoticeEmail` (already guaranteed
   by the `pending_edit` rule, and worth an explicit test given the consequence)
6. **blog_posts** — last; changes working code that 3,058 posts depend on

Migrations go to the primary database **and** the Neon test branch. A previous migration went to primary
only and every related test failed with `column ... does not exist`.

## Current state

Merged to `main` (`36fa788`, `d5778a0`): the list page (events only), `GET /api/user/submissions`,
`GET`/`PATCH /api/community/events/[id]`, `src/lib/events/edit-submission.ts`, `PublicEventForm` edit mode
and live-item warning, 6 integration tests.

**Two known defects in that merged code**, both from this review: the auto-approve contradiction, and
`detail` with no `detailKind`. Neither is user-visible yet — nothing links to the page for non-events and no
notification fires — but both must be fixed in step 1–2.

Not built: notifications, `pending_edit`, `rejection_reason`, the admin reason box, the past toggle,
`updated_at`, and every type other than events.

## Testing

Beyond ownership, whitelist and transition coverage:

- **Re-approving a `pending_edit` item sends no broadcast.** The obvious "one email, one in-app row" assertion
  passes even when the whole subscriber list is spammed, so assert on the broadcast call itself.
- **Auto-approver edit stays `approved`.** Split the existing "editing an approved item sets pending" test
  into ordinary-member and auto-approver cases; the second fails against today's code.
- **`isPast` for NULL-date and permanent rows** resolves to `false`.
- **Concurrent write** — an edit racing an approval yields 409, never a silent overwrite.
- **`canEdit`** is false where a type forbids editing, and `editHref` is absent when it is.
- A thrown email error does not fail the approval.

## Review findings

Revision 2 followed an adversarial review. Changes made:

| Finding | Change |
|---|---|
| Re-approval re-broadcasts to all subscribers | `pending_edit` status; broadcast guards fire only on `pending → approved` |
| Edit rule revokes auto-approve permission | Shared auto-approve helper on both create and edit |
| "Every submission API is POST-only" was **false** | Corrected; blog and `/api/user/ads` added |
| Blog omitted despite 3,058 owned rows, and has the opposite rule | Added, conflict resolved, sequenced last |
| `detail` conflated instants and dates | `detailKind` discriminator, required |
| `isPast` undefined for four types | Defined per type with a NULL fallback |
| ~15 independent status writers | `setApprovalStatus()` mandated, not merely advised |
| No concurrency detection | `updated_at` + conditional write + 409 |
| `createNotification` signature wrong; icons keyed on specific strings | Corrected |
| `specials` has no submission path | Moved out of scope |
| `ask_the_rabbi` "has no owner" was misleading | Corrected — submissions are owned |
| Interface lacked `canEdit` | Added |
| Shul managers unaddressed | Ownership is institutional where `shul_id` is set |
