---
name: atr-capability-not-admin-role
description: canManageAtr takes a Session and reads the database, never the token flag, and the five rabbi-submissions handlers adopt it
type: decision
date: 2026-08-03
status: accepted
---

**Decision:** One helper, `canManageAtr(session)`, gates every Ask the Rabbi
route. It takes the whole `Session` — matching the `isAuthorized` it replaced —
and reads `users.canManageAskTheRabbi` from the **database**, never from the
session.

**Context:** The five `rabbi-submissions` handlers checked
`session.user.role !== "admin"`, while every other Ask the Rabbi route already
accepted the capability. The submissions inbox is the one screen this permission
exists to serve, and it returned 401 to the only person holding it.

Two things had to be got right, and both are silent failures:

- **The signature.** A narrower `{ id?, role? }` parameter still typechecks when
  handed a whole `Session` — every property is optional — and returns `false` for
  everyone. No type error, no failing test, both users locked out. Matching the
  old signature means no call site can be migrated wrongly.
- **The guard must keep `!session?.user`.** It looks redundant next to the
  capability check, but it is the only thing narrowing `session` for the
  `session.user.id` dereferences further down both files.

**Chose over:** reading `session.user.canManageAskTheRabbi`, which **does exist**
(`auth.ts:57` puts it in the token, `:81` copies it to the session) and would
save a query. A token minted before the flag was granted carries the stale value,
so a newly permitted user keeps being refused until their session refreshes. Two
tests pin this in both directions — stale-false must still be allowed, forged-true
must still be refused — so the query cannot be optimised away later.

**Consequences:** A `member` holding the capability can now list, answer, reject
and delete submissions. Audited: every destructive power this grants, that
account already held through `DELETE /api/admin/ask-the-rabbi` and `quick-post`.
No new path into `/admin`. Submissions carry the public submitter's name and
email — new exposure, but to the person whose job is answering them.

Four inline copies of the check survive elsewhere in the ATR comments routes;
this decision did not claim to remove them.

Related: [[atr-screens-shared-by-both-shells]]
