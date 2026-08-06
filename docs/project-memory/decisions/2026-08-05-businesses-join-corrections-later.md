---
name: businesses-join-corrections-later
description: The corrections mechanism ships for the eight submission types first; businesses joins the same table once its field work lands
type: decision
date: 2026-08-05
status: accepted
---

**Decision:** Build the shared corrections mechanism for the eight
`SUBMISSION_TYPES` now. **Businesses uses the same table, but later** — not in
the same delivery.

**Context:** The first instinct was one mechanism covering everything at once,
and that was agreed before checking what it would take. It takes more than
assumed:

- **`businesses` is not in `SUBMISSION_TYPES`**, and that registry drives
  everything polymorphic here — ownership, editable fields, public paths,
  broadcast behaviour.
- It carries a status the others do not (`pending_payment`) and per-field
  visibility gated by subscription tier.
- Its changes queue is blocked on Part 0 of the business plan: `logoUrl` has no
  write path anywhere, so an editor offering it would be a lie.

**Chose over** shipping both together, which would have held a fix for a **live
data-loss defect** behind unrelated field work — itself currently blocked. Also
over two separate mechanisms, which ships fastest but leaves two systems doing
one job.

**Consequences:** One mechanism in the end, and the defect is fixed without
waiting. The business spec's own `business_pending_changes` table and its
"Changes" admin tab are superseded — that plan gets smaller when businesses
joins, rather than being reworked.

The corrections spec was revised on the same day it was written, because the
agreement to fold businesses in was made on my framing that it would simply use
the same table. That framing was too simple, and the decision was reopened
rather than built on.

Related: [[corrections-are-proposals-not-overwrites]],
[[business-work-split-into-two-plans]]
