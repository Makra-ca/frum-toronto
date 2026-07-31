---
name: edit-unpublishes-via-pending-edit
description: Editing an approved submission unpublishes it under a distinct pending_edit status rather than reusing pending
type: decision
date: 2026-07-31
status: accepted
---

**Decision:** A user editing an already-approved submission sends it to a new
`pending_edit` status, not `pending`. Approving a `pending_edit` item never
broadcasts.

**Context:** Approving does not merely flip a status — it emails every
subscriber. Reusing `pending` for corrections meant: approved → user fixes a
typo → `pending` → admin re-approves → the broadcast guard sees a non-approved
previous status and mass-emails the community again. For a shiva notice that is
re-sending a bereavement announcement because someone corrected a street
address.

**Chose over:** leaving edits at `pending` and adding a "don't email" checkbox
for the admin — relies on the admin remembering, every time, under time
pressure. Also over blocking edits to approved items entirely, which is what
blog did and is the problem this whole feature exists to fix.

**Consequences:** Roughly 53 call sites had to learn that `pending_edit` also
means "awaiting review", or corrections would vanish from every admin queue
while also being off the public site. A `broadcast_at` column backs the status
up, because a transition rule alone is defeated by a trip through `rejected`,
which erases publication history.

Related: [[broadcast-at-is-the-real-guard]], [[blog-adopts-unpublish-rule]]
