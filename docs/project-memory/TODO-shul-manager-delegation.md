# TODO — let a shul manager designate other people to help run their shul

**Status:** identified 2026-08-03, not designed, nothing built.
**Why it matters:** every staffing change at every shul has to go through the
admin, forever. A gabbai cannot add his assistant, his co-gabbai, or his
successor.

## What exists today

A `userShuls` row grants one person management of one shul. With it they can
edit that shul's details, davening schedules and documents from
`/dashboard/shuls/[id]`.

**Only an admin can create that row.** Both paths are admin-gated:

| Path | File | Guard |
|---|---|---|
| Assign directly (Admin → Shuls → Managers) | `api/admin/user-shuls/route.ts:53` | `role !== "admin"` → 401 |
| Approve a request (Admin → Shuls → Requests) | `api/admin/shul-requests/[id]/route.ts:16` | `role !== "admin"` → 401 |

There *is* a self-serve flow, but it runs the other direction — a person
**applies** and the admin approves (`/dashboard/shuls/request` →
`api/shuls/request`). That is application, not delegation.

## Measured state, production 2026-08-03

```
shuls                          14   (4 are [TEST], 1 is makra.ca)
real shuls                      9
userShuls assignments           1   ← on makra.ca, by a test account
real shuls with a manager       0
shul registration requests      0   ever
```

So the whole shul-manager feature is built, working, and **has never been used
by a real shul**. Delegation is the second step of a rollout whose first step
has not happened: there is nobody to delegate *from*.

**This is a sequencing fact, not an argument against building it.** The moment
one real gabbai is onboarded, the request "can my assistant do this too?"
follows immediately.

## Questions to settle before building

None of these have obvious answers, which is why this is a spec job and not a
bolt-on:

- Can a manager remove **another** manager, or only add?
- Can a manager remove **themselves** and leave the shul orphaned? If the last
  manager leaves, who owns the shul — does it revert to admin-only?
- Is there a cap on managers per shul?
- Does the admin get told when a shul adds someone? (Today, admin notifications
  are the only kind that exist — see the notification gap below.)
- Must the invitee already have an account, or does the manager invite by email
  and the account gets created on acceptance?
- Does the invitee accept, or is being added enough? Being silently granted
  authority over a listing is worse than being asked.
- Can a manager delegate to someone who then delegates onward, or is it one
  level deep?

## Prerequisite — already done

`3a62e02` (2026-08-03) made the **`userShuls` row the authority** in
`canUserManageShul`, instead of requiring `users.role === "shul"` on top of it,
and stopped both assignment paths overwriting the target's role.

That fix is load-bearing for this feature. Before it, creating an assignment ran
`UPDATE users SET role='shul'` unconditionally — so a gabbai adding a helper who
happened to be a business owner would have silently destroyed that person's
business access, and adding an admin would have locked them out of `/admin`.
Delegation means non-admins create assignments, which is exactly when that would
have started firing.

## Related, deliberately not bundled

**Shul-scoped notifications** were considered on 2026-08-03 and **rejected for
now**: notifying each shul's managers about changes to their shul. Rejected
because only two kinds of account can edit a shul at all (admins, and that
shul's own managers), so with one manager per shul the only real case is "the
admin edited it". Revisit when shuls have multiple managers — i.e. after this
feature ships.

**Five test shuls are live on the public site** (`isActive: true`): ids 2–5
prefixed `[TEST]`, plus `makra.ca`. Two of them duplicate real shuls already in
the directory (Shaarei Shomayim, Beth Jacob V'Anshei Drildz). Separate cleanup
decision; listed here because they distort every count above.
