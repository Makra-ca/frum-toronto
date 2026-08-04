---
name: business-review-is-admin-only
description: No canManageBusinesses capability is added; claim and change review is admin-role-only, deliberately
type: decision
date: 2026-08-04
status: accepted
---

**Decision:** Reviewing business claims and pending changes is **admin-role
only**. No `canManageBusinesses` capability column is added.

**Context:** This runs against the direction of
[[atr-capability-not-admin-role]], which established that a review queue should
be gated on a capability so it can be delegated, and that notifications should
reach admins ∪ capability holders.

The difference is that Ask the Rabbi has a real second reviewer — one person
holds `canManageAskTheRabbi` and does the work. Businesses have exactly one
reviewer, and no candidate for a second. Adding a column, wiring it through the
notification map, and building a non-admin review surface would serve nobody
today.

**Chose over:** adding the capability now for symmetry. Rejected as speculative:
the ATR capability was added because a person existed who needed it.

**Consequences:** Stated explicitly in the spec so it reads as a decision rather
than an omission — the failure mode being a later reader assuming it was simply
forgotten. If a second reviewer ever appears, the upgrade path is the one already
proven: add the column, add an entry to `CAPABILITY_BY_CONTENT`, and give the
non-admin audience a link they can open.
