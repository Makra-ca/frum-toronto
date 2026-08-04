---
name: auto-approve-businesses-gates-edits-not-creation
description: canAutoApproveBusinesses is the trusted-owner flag for edits, not a gate on business creation — reversing yesterday's wiring
type: decision
date: 2026-08-04
status: accepted
---

**Decision:** `canAutoApproveBusinesses` marks a **trusted owner** whose *edits*
to an existing listing go live without review. It does **not** gate approval of
newly created businesses. Commit `268b1f1` wired it to creation and must be
reworked before the claim/edit project ships. Business creation keeps `isTrusted`.

**Context:** The flag was in the admin permissions dialog, saved correctly, and
read by no code — it was nearly deleted as dead. The 2026-07-31 design explains
why it existed:

> Ordinary owner — may edit, but changes wait for admin confirmation.
> Trusted owner — changes go live immediately, with an audit trail.
> **This is exactly what `canAutoApproveBusinesses` was always meant to be.** It
> is not dead; it was built before the feature it gates.

On 2026-08-03, [[dead-toggles-get-wired-not-removed]] decided to wire all three
dead toggles. Implementing it, I attached this one to `businesses/create` without
reading the parked design, giving it a meaning it was never intended to have.
The July document had predicted the day precisely: *"the toggle we nearly deleted
as dead becomes live the day this ships."*

**Chose over:** keeping the creation wiring and inventing a second flag for
trusted owners. That leaves two flags with near-identical names governing
different halves of the same feature.

**Consequences:** `268b1f1` is unpushed, so nothing user-facing has to be undone.
Business **creation** stays on `isTrusted` — a flag marked "legacy, kept for
backwards compatibility" and set on 22 users who own zero businesses between
them. That is a deliberate deferral, not an endorsement; whatever should gate
creation auto-approval is unresolved and out of scope here.

**The lesson worth carrying:** before giving meaning to an unused flag, check
whether a parked design already assigned it one. The answer was written down and
I did not look.

Related: [[dead-toggles-get-wired-not-removed]], [[claim-before-edit]]
