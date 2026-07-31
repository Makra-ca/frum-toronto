---
name: broadcast-at-is-the-real-guard
description: An item may be announced to subscribers at most once, ever, enforced by a broadcast_at stamp rather than by transition rules
type: decision
date: 2026-07-31
status: accepted
---

**Decision:** Publication is a fact about the ROW. `broadcast_at` is stamped the
first time an item is announced, and no announcement fires while it is set.

**Context:** A transition-only rule (`pending → approved` broadcasts) is
defeated by `approved → edit → pending_edit → rejected → edit → pending →
approve`, because `rejected` erases the fact that the row was ever published.
Several admin create routes also insert `approved` without stamping, so an
admin pressing Approve from a stale queue tab would announce something that had
been public for weeks.

**Chose over:** relying on the status machine alone. That was the original
design and it has at least two escape routes.

**Consequences:** The guard is three-part — `broadcast_at IS NULL`, previous is
not `pending_edit`, and previous differs from next. The stamp is claimed
atomically (`WHERE broadcast_at IS NULL`) so two admins pressing Approve
simultaneously cannot both send. Create paths that publish must stamp it
themselves.

Related: [[edit-unpublishes-via-pending-edit]], [[single-writer-for-approval-status]]
