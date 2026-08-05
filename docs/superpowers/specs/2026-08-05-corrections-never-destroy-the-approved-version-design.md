# Corrections never destroy the approved version

**Date:** 2026-08-05
**Status:** Design approved by Daniel, pending review

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
across all seven types, zero rejected events. The trap is armed and has not
fired, so this can be fixed properly with no cleanup.

## Design

**One shared `pending_changes` table for all eight content types** — event,
simcha, classified, alert, shiva, tehillim, blog, **and business**.

**The live row is never touched.** The item stays exactly as approved, visible,
for as long as a correction waits.

| | Today | After |
|---|---|---|
| Submitter saves a correction | Overwrites the original; item goes offline | Original untouched; item stays live |
| Admin approves | Item returns, changed | Accepted fields applied |
| Admin rejects | **Item lost permanently** | Nothing changes; item stays as approved |
| Admin rejects 1 of 5 fields | Not possible | Four apply; one does not; submitter told why |

### One mechanism, not two

The business claim spec (`2026-08-04-business-claim-and-owner-editing-design`)
designed its own `business_pending_changes` for exactly this reason. Rather than
two tables and two review screens doing the same job, **businesses uses this
shared mechanism**. That spec and its plan are revised accordingly — neither is
built, so nothing is wasted, and the business work gets *smaller*.

### Rules

| Question | Answer |
|---|---|
| Does the item stay live while a correction waits? | **Yes, all eight types.** One rule everywhere |
| How is a correction reviewed? | **Field by field**, each rejected field taking an optional reason |
| Where? | **One "Corrections" screen** covering all eight types |
| Two people edit the same item? | The newer correction **replaces** the older |
| Editing an item that is not yet approved? | **Overwrite it directly** — it is not on the site, so there is nothing to protect, and a correction to an unreviewed item would mean two reviews for one thing |
| Admin edits someone's item? | **Applies immediately, no record.** Unchanged from today |
| Withdrawing a correction | The submitter can cancel their own |
| Item deleted or unapproved while a correction waits | The correction is discarded and the submitter told |
| Grouped fields (hours, a shiur's schedule) | **One field** for review, not split |
| Who reviews | **Admin only.** No capability holder gets a correction queue |
| Trusted submitters (`canAutoApprove*`) | Corrections **apply immediately**, matching how their submissions already work |
| Time-sensitive types (shiva) | **No special handling** — see Risks |

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

`pending_edit` stays in the codebase; nothing urgent depends on removing it. It
is simply unused by the correction path.

## What this supersedes

- **`2026-07-31-blog-adopts-unpublish-rule`** — blog no longer goes dark on edit.
  One rule everywhere.
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
| Review granularity | Per field, optional per-field reason |
| Review location | One Corrections screen |
| Repeat corrections | Newer replaces older, whoever submits it |
| Unapproved items | Edited directly, no correction record |
| Admin's own edits | Applied immediately, no record |
| Reviewer | Admin only |
| Time-sensitive types | No special handling |
