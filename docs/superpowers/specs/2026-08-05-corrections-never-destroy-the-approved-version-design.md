# Corrections never destroy the approved version

**Date:** 2026-08-05
**Status:** Revision 2 — whole-submission review; eight types, businesses later.

## Problem

A submitter correcting a typo can permanently delete their own approved item,
and the admin has no way to undo it.

`applyEdit` (`src/lib/submissions/apply-edit.ts:134-145`) is a plain in-place
`UPDATE`. The moment the submitter presses Save:

1. **The approved text is overwritten.** Not archived — gone.
2. **The item leaves the site**, because every public page requires
   `approvalStatus = "approved"` and the row is now `pending_edit`.
3. It waits in the admin queue.

Approving returns it, changed. **Rejecting strands it**: off the site, holding
text the admin rejected, with no earlier version anywhere to restore.

> **The threads note says "rejecting destroys the approved version". That is not
> quite right, and the distinction matters.** Rejection writes only
> `approvalStatus` and `rejectionReason` (`set-approval-status.ts:100-109`) and
> deletes nothing. The loss happened at **Save**. Any fix that only changes what
> rejection does cannot work — the data is gone before rejection is reached.

There is a quieter half to the same flaw: between Save and review, the item is
**off the site**. If the admin never gets to it, it stays off indefinitely and
nobody is told.

**Nobody is currently stuck** — measured 2026-08-05: zero rows in `pending_edit`
across all eight types, zero rejected rows anywhere. The trap is armed and has not
fired, so this can be fixed properly with no cleanup.

## Design

**One shared `pending_changes` table for the eight submission types** —
`event`, `simcha`, `classified`, **`kosherAlert`**, `alert`, `shiva`,
`tehillim`, `blog`. These are exactly the keys of `SUBMISSION_TYPES`
(`src/lib/submissions/types.ts`).

> **Corrected in revision 2.** An earlier draft listed seven and omitted
> **kosher alerts** — which has 1,587 approved rows, broadcasts on approve, and
> is the type most like shiva for time-sensitivity. A recall correction sitting
> in a queue is the same problem.

**The live row is never touched.** The item stays exactly as approved, visible,
for as long as a correction waits.

| | Today | After |
|---|---|---|
| Submitter saves a correction | Overwrites the original; item goes offline | Original untouched; item stays live |
| Admin approves | Item returns, changed | The correction is applied |
| Admin rejects | **Item lost permanently** | Nothing changes; item stays as approved. Submitter told why, can resubmit |

### One mechanism, not two

The business claim spec designed its own `business_pending_changes` for exactly
this reason. **Businesses will use this shared table — but not yet.**

`businesses` is not in `SUBMISSION_TYPES`, and everything polymorphic here is
driven by that registry: ownership, editable fields, public paths, broadcast.
Businesses also carries a status the others do not (`pending_payment`) and
per-field visibility gated by subscription tier. And its changes queue is
blocked on Part 0 — `logoUrl` has no write path anywhere, so an editor offering
it would be a lie.

So: build the shared mechanism for the eight submission types now, which fixes a
live data-loss defect immediately; businesses joins the same table once its field
work lands. One mechanism in the end, and the fix does not wait on unrelated
work.

### Rules

| Question | Answer |
|---|---|
| Does the item stay live while a correction waits? | **Yes, all eight types.** One rule everywhere |
| How is a correction reviewed? | **Whole submission** — approve or reject, with an optional reason on rejection |
| Where? | **One "Corrections" screen** covering all eight types |
| Two people edit the same item? | The newer correction **replaces** the older |
| Editing an item that is not yet approved? | **Overwrite it directly** — it is not on the site, so there is nothing to protect, and a correction to an unreviewed item would mean two reviews for one thing |
| Admin edits someone's item? | **Applies immediately, no record.** Unchanged from today |
| Withdrawing a correction | The submitter can cancel their own |
| Item deleted or unapproved while a correction waits | The correction is discarded and the submitter told |
| Grouped fields (mourner names, davening times) | Shown in the comparison; the decision is on the whole submission |
| Who reviews | **Admin only.** No capability holder gets a correction queue |
| Trusted submitters (`canAutoApprove*`) | Corrections **apply immediately**, matching how their submissions already work |
| Time-sensitive types (shiva) | **No special handling** — see Risks |

### The admin can still edit an approved item directly

Unchanged, and worth stating because it is the obvious question. Admin edit
routes write straight to the row and deliberately do **not** touch
`approvalStatus` — `setApprovalStatus` owns it. So an approved item stays
approved, the change is live at once, and no queue is involved.

Corrections are the *submitter's* path. The admin never uses them.

### Editing a rejected item

`resolveApprovalStatus` (`auto-approve.ts:28`) forces `rejected → pending`
**before** the auto-approve check, deliberately, so an auto-approver cannot
overturn an admin's rejection by editing. That rule is untouched: a rejected item
is not live, so it takes the direct-overwrite path and returns to `pending` for
review — **even for a trusted submitter.**

Without this, "trusted corrections apply immediately" would let a trusted user
re-publish something the admin had rejected.

### Two people, one item

`canEditRow` (`src/lib/submissions/ownership.ts:25-43`) returns true for the
owner **or** a manager of the linked shul, so two different people can correct
the same item. Businesses never had this — ownership there is a single column.

Chosen: the newer correction replaces the older, matching the one-waiting-
correction rule. The known cost is that a shul manager can silently replace a
submitter's waiting correction. Accepted at this scale — there is one shul
manager, and it is a test account.

### What `pending_edit` becomes

Corrections no longer change the item's status at all: it stays `approved`
throughout. So the re-broadcast problem `pending_edit` was invented to solve
(`decisions/2026-07-31-edit-unpublishes-via-pending-edit`) **cannot arise** — the
status never leaves `approved`, so no broadcast guard is ever consulted.

`pending_edit` stays in the codebase, but **nothing will ever produce it again** —
creates pass `previousStatus = null`, so it only ever came from the edit path.
That leaves dead controls in the admin UI: a "Awaiting re-approval" filter option
in five admin pages, an entry in the kosher-alerts filter, the `ApprovalCard`
badge, `PENDING_STATUSES`, and the dashboard badge. Filters that can never match.

Removing them is tidy-up, not urgent, but it should be listed in the plan rather
than discovered later.

**`applyEdit` survives**, because the unapproved-item path still overwrites
directly. It gains a branch: approved item → write a `pending_changes` row;
anything else → today's behaviour. Its three callers
(`events/edit-submission.ts`, `submissions/edit-route.ts`,
`user/blog/[id]/route.ts`) and the eight edit pages that reach them are unchanged
in shape.

## What this supersedes

- **`2026-07-31-blog-adopts-unpublish-rule`** — blog no longer goes dark on edit.
  One rule everywhere. Note its mitigation — granting Rochel
  `canAutoApproveBlog` so her corrections stayed live — is no longer needed for
  that reason. **The grant stays** (it also auto-approves her new posts, which
  was wanted independently); it simply is not load-bearing any more.
- **`2026-07-31-edit-unpublishes-via-pending-edit`** — its *goal* is preserved
  and strengthened; its *mechanism* is no longer used for corrections.
- **The business spec's own `business_pending_changes` table and its "Changes"
  admin tab** — replaced by the shared table and the shared Corrections screen.

## Risks

**A correction can wait indefinitely, and the wrong version stays live.** For a
classified that is harmless. For a **shiva notice** — a corrected levaya time or
address — a correction waiting two days is worthless while wrong details remain
public.

Decided knowingly: still better than today, where the notice **disappears
entirely**. Softening options were offered (flagging time-sensitive types in the
queue; letting shiva corrections apply immediately) and declined in favour of one
rule. Revisit if it bites.

**A shul manager can silently replace a submitter's waiting correction.** See
above.

**Admin edits still leave no trace**, so "who changed this and when" has no
answer, and a submitter whose words the admin rewrote is still not told. That
remains an open thread, deliberately not solved here.

## Decisions

| Decision | Choice |
|---|---|
| Storage | One shared `pending_changes` table, all eight types |
| The live row | Never touched until approval |
| Visibility | The item stays live throughout, every type |
| Review granularity | **Whole submission**, optional reason on rejection |
| Review location | One Corrections screen |
| Repeat corrections | Newer replaces older, whoever submits it |
| Unapproved items | Edited directly, no correction record |
| Admin's own edits | Applied immediately, no record |
| Reviewer | Admin only |
| Time-sensitive types | No special handling |
