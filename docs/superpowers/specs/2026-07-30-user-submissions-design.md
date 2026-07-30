# User submissions: view, edit, and hear back

**Date:** 2026-07-30
**Status:** approved, not yet implemented (events partially built — see *Current state*)

## Problem

A user who submits content to FrumToronto cannot see it again, change it, or withdraw it. Every public
submission API exports `POST` only. There is no `[id]` route, no dashboard page, and no notification when
an admin approves or rejects the item.

The consequences are all borne by the admin:

- Any correction becomes an email. This spec exists because of one: a school secretary wrote in asking to
  change a graduation date, saying *"I didn't know how to edit an existing booking, so I added it as a new
  one."* She was not confused — there genuinely is no way.
- Someone who cannot edit resubmits, so the admin gets duplicates and has to work out which is current.
- Nobody learns the outcome. "Did you get my event?" and "is it up yet?" are support load that a single
  email would remove.

## Decisions

Settled with the owner before design:

| Decision | Choice | Rejected alternatives |
|---|---|---|
| Structure | **One list** at `/dashboard/submissions`, all types together | A page per type; one generic schema-driven form |
| Editing an approved item | **Back to `pending`, hidden until re-approved** | Stays live with admin notified; locked after approval; per-field rules |
| Notification channel | **Email on approve and reject, plus an in-app record** | In-app only; email only; rejections only |
| Rejection reason | **Optional**, with a written fallback when blank | Required; canned list; no reason at all |
| Email opt-out | **None — transactional** | New preference; reuse `communityEvents` |
| Old items | **Active by default, past behind a toggle** | Show everything; drop past entirely |
| Scope | **All content types** | Events first; events + classifieds + simchas |

Two of these carry a known cost, accepted deliberately:

- **Unpublishing on edit** removes a live event from the calendar until an admin acts. For a time-sensitive
  item that is worse than the typo being fixed. Mitigated by warning in the form before saving, never by
  changing the rule.
- **An optional rejection reason** means the blank path is the one a busy admin will take. Mitigated by
  writing the fallback copy so it reads deliberate rather than as a shrug.

## State machine

| From | Trigger | To | Notified |
|---|---|---|---|
| — | user submits | `pending` | admin (already built) |
| `pending` | admin approves | `approved` | **user: email + in-app** |
| `pending` | admin rejects | `rejected` | **user: email + in-app**, reason if given |
| `approved` | user edits | `pending`, unpublished | admin |
| `pending` | user edits | `pending` | admin |
| `rejected` | user edits & resubmits | `pending` | admin |

The user is emailed about the admin's actions, never their own. Re-approval after an edit needs no extra
code — it is the same approve path.

## Ownership is the binding constraint

Only rows carrying a `user_id` can ever be shown or edited. Measured on production, 2026-07-30:

| Type | Owned | Total | Notes |
|---|---|---|---|
| classifieds | 10 | 1,670 | |
| simchas | 9 | 16,551 | |
| events | 6 | 94 | |
| kosher_alerts | 1 | 1,588 | |
| alerts | 1 | 1 | |
| shiva_notifications | 1 | 1 | most sensitive content on the site |
| tehillim_list | 2 | 2 | already has delete, no edit |
| specials | 0 | 3 | |
| **shiurim** | — | — | **no owner column at all** |
| **ask_the_rabbi** | — | — | **no owner and no `approval_status`** |

Everything else is legacy import with `user_id = NULL`, and is permanently invisible to this feature. That
is correct behaviour, not a gap: those rows have no submitter who could own them.

Two types do not fit as-is:

- **`shiurim`** needs a `user_id` migration before any of this applies. Existing rows can never be
  attributed.
- **`ask_the_rabbi`** has a different lifecycle — questions are *answered*, not approved — and needs its own
  design. It is out of scope here.

## Components

### `/dashboard/submissions` — the list

One page, all types, newest first. Each row carries a type chip, a status chip, and a coloured stripe on the
left edge so state is scannable without reading labels.

Status wording is reader-facing, not schema-facing: **On the calendar** / **Published**, **Awaiting
approval**, **Not approved**. A rejected row shows the reason and offers **Edit & resubmit** rather than
being a dead end.

Items whose date has passed collapse behind a *Show past submissions* toggle, so the list stays about things
still worth acting on.

### `GET /api/user/submissions`

Returns a single flat, type-agnostic array so the page never changes as types are added:

```ts
interface Submission {
  id: number;
  type: string;          // "event" | "simcha" | ...
  typeLabel: string;     // "Event"
  title: string;
  detail: string | null; // ISO instant or date, formatted by the page in Toronto time
  approvalStatus: string;
  rejectionReason: string | null;
  isPast: boolean;
  createdAt: string | null;
  editHref: string | null;
  publicHref: string | null;
}
```

Each type contributes one query filtered by `user_id`; results are merged and sorted in the route.

### `PATCH /api/community/<type>/[id]`

One route per type, each delegating its rules to a small testable module (see `lib/events/edit-submission.ts`,
already built). Every one must:

1. reject an unauthenticated caller (401);
2. run `assertCanPost` — the same verified-and-not-blocked gate as creating;
3. reject a caller who is not the owner, and treat `user_id IS NULL` as unowned (403);
4. apply a **field whitelist**, so a hostile client cannot reassign `user_id` or self-approve by posting
   extra keys;
5. set `approval_status = 'pending'` and report whether the item was previously live.

### `notifySubmitter()`

Sits beside the existing `notifyAdminOfSubmission()` in `src/lib/notifications.ts`. Takes the owner's id, the
outcome, and the item, then:

- inserts a row via the existing `createNotification(userId, …)` — the `notifications` table is already
  per-user, and `/dashboard/notifications` renders it with no changes;
- sends one of two transactional emails.

Wrapped in try/catch with a `[NOTIFY]` prefix, matching the admin notifier: a failed email must never fail
an approval.

### Emails

Two templates, both linking to `/dashboard/submissions`:

- **Approved** — item name, the date rendered in Toronto time via `formatInstant`, and a link to the live page.
- **Not approved** — the reason, or the fallback when blank, plus the resubmit link.

Both carry the standard FrumToronto footer identification but **no unsubscribe link**. Under CASL a
transactional message needs no consent, but still requires sender identification — so the footer stays and
the opt-out goes.

### Admin

A short, optional reason box in the reject dialog, writing to a new `rejection_reason` column per type.
Follows the pattern `homepage_ads` and the business video queue already use.

## Risks

**Every path that flips `approval_status` must notify.** This is the likeliest way to ship something
half-working. The approvals queue and each per-type admin page may set the status independently; if so, the
notify call belongs somewhere they share, or approvals from one screen will silently tell nobody. **Trace
every write path before writing any code.**

**Scope.** Nine types, each with its own ownership rule, edit form, approve path and tests — roughly nine
times the surface of the events work, for types that currently hold single-digit owned rows. Suggested order,
so the tail can be cut without redesign:

1. events *(mostly built)* — the type generating the actual support load
2. classifieds, simchas — the two ordinary people post
3. kosher_alerts, alerts, specials
4. shiva_notifications — last, and reconsider: bereavement details are the most sensitive content on the
   site, and self-service editing of a live notice deserves its own thought
5. shiurim — only after a `user_id` migration

**Migrations must be applied to the primary database *and* the Neon test branch.** A previous migration went
to primary only and every related test failed with `column ... does not exist`.

## Current state

Built and merged to `main` (`36fa788`, `d5778a0`):

- `/dashboard/submissions` list page (events only)
- `GET /api/user/submissions`
- `GET`/`PATCH /api/community/events/[id]`
- `src/lib/events/edit-submission.ts` — ownership and re-approval rules, kept out of the route so they are
  testable without HTTP or next-auth
- `PublicEventForm` gained an optional edit mode and the live-item warning
- 6 integration tests

Not built: notifications of any kind, `rejection_reason`, the admin reason box, the past-items toggle, and
every type other than events.

## Testing

- Ownership: an owner may edit; a stranger gets 403; an unowned (`user_id IS NULL`) row is never editable.
- Field whitelist: posting `user_id` or `approval_status` changes neither.
- Transition: editing an approved item sets `pending` and reports `wasUnpublished`; editing a pending item
  reports `false`.
- Notification: approving inserts exactly one in-app row for the owner and sends one email; a thrown email
  error does not fail the approval.
- List: returns only the caller's rows; never returns another user's; `isPast` is computed in Toronto time.
