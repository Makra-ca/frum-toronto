---
name: dead-toggles-get-wired-not-removed
description: The three permission toggles that do nothing will be made to work rather than deleted from the dialog
type: decision
date: 2026-08-03
status: accepted
---

> **Partially superseded 2026-08-04** by
> [[auto-approve-businesses-gates-edits-not-creation]]. The decision to wire the
> toggles rather than delete them stands, and the Ask the Rabbi and Shuls wirings
> are unchanged. What changed is `canAutoApproveBusinesses`: this record's
> Consequences section pointed it at business *creation*, but a parked design
> from 2026-07-31 had already assigned it to owner *edits*. The creation wiring
> in `268b1f1` is reverted.

**Decision:** `canAutoApproveBusinesses`, `canAutoApproveAskTheRabbi` and
`canAutoApproveShuls` will be **wired up to do what the dialog heading
promises**, rather than removed. Not yet built.

**Context:** All three are saved by the admin permissions dialog and read by no
decision anywhere — verified by grepping each across `src/`, excluding the
schema, the admin CRUD and the UI that renders them: zero references. Ticking
one produces a success toast and no behaviour change.

This **supersedes** [[business-owners-cannot-edit-their-listing]], which left
them in place "for now" on the reasoning that removing them would bury the real
finding. The finding is recorded; the toggles are still lying to the admin.

**Chose over:** deleting them from the dialog. A UI that silently does nothing
is worse than a missing feature, but the instinct behind all three is right, and
the surrounding work has since made two of them tractable.

**Consequences:** Businesses is the awkward one — creation currently
auto-approves off `isTrusted` (`businesses/create/route.ts:150`), a different
switch on a different screen, so wiring the toggle means untangling that first.
`isTrusted` is set on 22 users who own zero businesses between them.

An audit on the same day found a related mislabelling worth fixing alongside:
`canAutoApproveShiurim` is filed under "submit without approval" but is actually
a **403 gate on submitting at all**, and since `shiurim.approvalStatus` defaults
to `approved`, holding it means publish-instantly. `canPostSpecials` has the same
shape. Three different meanings share one dialog heading.
