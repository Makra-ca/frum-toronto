---
name: session-update-rereads-claims-from-the-database
description: The jwt update branch ignores the client payload and re-reads role and flags from the database, rather than being deleted
type: decision
date: 2026-08-05
status: accepted
---

**Decision:** The NextAuth `jwt` callback's `trigger === "update"` branch ignores
the client-supplied `session` argument entirely and re-reads `role`, `isTrusted`
and `canManageAskTheRabbi` from the database via `loadUserClaims`.

**Context:** The branch previously did `token.role = session.role`, where
`session` is whatever was POSTed to `/api/auth/session`. Verified by exploit
against a running server: a plain `member` sending `{"role":"admin"}` became an
admin — `/admin` went 307 → 200 and `/api/admin/users` returned 200. Middleware,
`auth.config` and ~101 admin routes all trust that one token field.

**Chose over** deleting the `update` branch outright, which was simpler and safe
— nothing in the codebase calls `update()` today. Rejected because the branch has
a legitimate purpose: a role granted while someone is logged in should be picked
up without re-authenticating. Re-reading keeps that and makes the client's
opinion irrelevant, which deleting would have foreclosed.

**Consequences:** `update()` is now strictly better than before — verified in
both directions: a forged `{"role":"admin"}` leaves the session a `member`, and a
DB grant followed by `update({})` is picked up. The `session` argument is no
longer destructured, so the absence is structural rather than only commented.

This is the third time in two days the answer has been "read the database, not
the token". Related: [[atr-capability-not-admin-role]],
[[userShuls-row-is-the-authority]].
