---
name: listing-stays-live-during-review
description: An owner's pending edit is stored separately so the live listing is never touched — the opposite of every other content type
type: decision
date: 2026-08-04
status: accepted
---

**Decision:** An ordinary owner's edit goes into a **separate pending-changes
table**. The live listing row is never modified until the admin approves. This
makes businesses the only content type where **an edit does not unpublish**.

**Context:** Every other type follows
[[edit-unpublishes-via-pending-edit]] — `applyEdit` writes the new values
straight onto the row and sets `pending_edit`, taking the item off the site until
re-approved. For a directory listing that is the wrong trade: a blog post going
dark for a day is an inconvenience; a listing going dark takes a business's phone
number off the internet because they corrected their opening hours.

The rule "the listing stays live and unchanged" was set on 2026-07-31 and is what
forces a separate table. `src/lib/submissions/` cannot deliver it — its entire
model is overwrite-in-place — and `businesses` could not be added to that
registry anyway without `broadcast_at` and `rejection_reason` columns it does not
have.

**Chose over:** reusing the submissions system, which would have been cheaper and
more consistent. Rejected on the incompatibility above, not on effort.

**Consequences:** A deliberate divergence from an accepted decision, argued
rather than drifted into. The single-writer discipline and submitter-notification
path from `setApprovalStatus` are still reused, so only the storage model
differs.

A correction worth recording: an earlier draft justified this by claiming that
rejecting an edit destroys the approved version. **That is wrong** — rejection
writes only a status. The content was already lost when the owner pressed Save,
because the update is in place. The accurate justification is stronger:
**no proposed-vs-current storage exists for any content type**, so an admin
reviewing an edit today cannot see a diff at all.

Related: [[review-per-field-not-per-submission]], [[claim-before-edit]]
