---
name: userShuls-row-is-the-authority
description: Shul management comes from the assignment row, not from users.role, and assigning a manager only ever promotes a plain member
type: decision
date: 2026-08-03
status: accepted
---

**Decision:** `canUserManageShul` and `getUserManagedShulIds` are driven by the
`userShuls` row alone (admins still pass unconditionally). The two assignment
paths promote a user to `role: "shul"` **only if their current role is
`member`**, and never overwrite any other role.

**Context:** Both promotion paths ran `UPDATE users SET role='shul'` with no
condition, under a comment reading *"Update user role to 'shul' if not already"*
— a guard the code did not have. `UserPicker` lists every user with no role
filter, so picking the admin from that dropdown demoted the site's **only**
admin out of `/admin`, with a success toast and no way back. The un-assign path
in `user-shuls/[id]` already guarded correctly; the two promotion paths did not.

The two bugs were load-bearing on each other. `canUserManageShul` required
`role === "shul"` *on top of* the assignment row, which is why the unconditional
promotion existed: without it, an assignment did nothing. Fixing only the
overwrite would have traded a loud bug for a silent one — leave a business
owner's role alone and their assignment quietly stops working.

**Chose over:** promoting from any role (keeps the lockout), and leaving
`canUserManageShul` as-is while guarding the promotion (silently breaks
assignments for `business` and `content_contributor`).

**Consequences:** Not a widening — `userShuls` rows can only be created through
two admin-gated endpoints, so the row already encodes the grant. `role: "shul"`
is now purely cosmetic, driving the dashboard's "Manage My Shuls" link; a
non-member assigned to a shul manages it but does not see that link. Nobody is
in that position today.

This is a prerequisite for [[shul-manager-delegation]]: delegation means
non-admins create assignments, which is exactly when the overwrite would have
started firing.
