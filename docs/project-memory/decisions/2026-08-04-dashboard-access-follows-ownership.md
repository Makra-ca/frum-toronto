---
name: dashboard-access-follows-ownership
description: The Manage My Business link is shown when a user owns a business, not when they hold a role
type: decision
date: 2026-08-04
status: accepted
---

**Decision:** The dashboard's "Manage My Business" link appears when the user
**actually owns a business**, replacing the `role === "business"` check.
Approving a claim does **not** promote anyone's role.

**Context:** The link is gated on `role === "business" || role === "admin"`
(`(dashboard)/dashboard/page.tsx:222`). Approving a claim as originally specced
sets `businesses.user_id` and leaves the claimant a `member` — so they would own
a listing with **no navigation to reach it**. The API already works: `my-businesses`
filters on `userId` alone, never on role.

The obvious fix — promote them to `role: "business"`, mirroring the shul flow —
does not work either. `token.role` is set only at sign-in
(`src/lib/auth/auth.ts:43-68`); the only other path requires the client to call
`update()`. So a user whose claim is approved while logged in would be told they
are approved and still see nothing until they logged out and back in.

**Chose over:** role promotion. It is what shuls do, and it carries this same
latent staleness — which this decision declines to copy.

**Consequences:** Ownership becomes the single source of truth for access, so
revoking an owner removes the link with no second field to keep in step. The shul
equivalent has the same problem and would benefit from the same fix; not in scope
here.

Note this is the second time in two days that a role check has been the wrong
mechanism — see [[userShuls-row-is-the-authority]], where the assignment row
replaced `role === "shul"` for the same reason.
