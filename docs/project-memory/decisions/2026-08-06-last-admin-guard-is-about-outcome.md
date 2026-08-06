---
name: last-admin-guard-is-about-outcome
description: The last-admin check asks "would this leave nobody able to administer the site", not "is this me"
type: decision
date: 2026-08-06
status: accepted
---

**Decision:** `PATCH /api/admin/users/[id]` refuses a change that would leave
zero active admin accounts. The rule is expressed as an outcome
(`wouldRemoveLastAdmin`, `src/lib/permissions/last-admin.ts`) rather than as a
self-demotion guard, and it counts *other* active admins in the database rather
than comparing ids.

**Context:** The route had no schema and no guards, and production has exactly
one active admin. `/admin`, the middleware and ~101 admin API routes all gate on
`role === "admin"`, and there is no recovery path in the application — the only
way back from an accidental demotion is direct SQL against production.

Two ways to lose it, not one: `role` and `isActive`. `isActive` is this project's
ban flag, checked in both sign-in paths, so disabling the account locks it out
exactly as thoroughly as demoting it. Both are covered.

**Chose over:**

- *"You cannot demote yourself."* The intuitive framing and insufficient — an
  admin demoting a *different* last admin produces an identical lockout, and the
  self-check would wave it through.
- *"Admins cannot be demoted at all."* Would make the role permanent, which is
  its own lockout when someone leaves.

**Consequences:**

- The guard releases the moment a second active admin exists, because the
  outcome is then safe. A guard that kept refusing would be a different kind of
  lockout.
- It costs one `count(*)` and only when the target is currently an active admin,
  so ordinary permission edits add no query.
- **The decision is a pure function, tested as a unit** — it cannot be driven to
  the blocking state through the route, because the integration database is a
  copy of production and always contains a real admin. The route test covers the
  other direction: that a guard sitting in front of every user edit does not
  start refusing ordinary ones.
- Same shape as `resolveBusinessApprovalStatus` and `resolveApprovalStatus`: the
  *decision* is pure and testable, the *route* does I/O.

Related: [[single-writer-for-approval-status]]
