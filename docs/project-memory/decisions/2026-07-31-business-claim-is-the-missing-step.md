---
name: business-claim-is-the-missing-step
description: Business self-editing is blocked not by a missing edit route but by no business having an owner at all
type: decision
date: 2026-07-31
status: accepted
---

**Decision:** Do not build business editing yet. Build the claim flow first —
a way for a business owner to be linked to the listing that already exists.

**Context:** Measured on production, 2026-07-31:

- **1,633 businesses, 0 with an owner account.** `user_id` is NULL on every
  row. 1,632 came from the legacy import; one was created this year.
- **0 business subscriptions have ever been created.** The four plans exist
  (Free, Standard $27, Premium $65, Elite $120), the registration flow exists,
  the PayPal integration exists. Nobody has been through it.
- `/api/businesses/[id]` has only a GET. There is no owner-facing edit route or
  edit page anywhere.

So the paid directory is built and never launched, and the 1,633 listings are a
directory the admin maintains by hand rather than accounts anyone owns.

**Chose over:** building the edit route now, which was the obvious next step
after finding it missing. It would serve zero people: there is nobody to grant
an edit permission to. A door for a room nobody can enter.

**Consequences:** The order is claim → edit → permission. Shuls already have
the equivalent of step one (`shul_registration_requests` → admin approves →
`user_shuls` row), and the shul pattern for steps two and three is proven:
edits go live with an in-app admin notification as the audit trail. Businesses
have nothing for step one; the only existing path is creating a NEW listing,
which would duplicate the one already in the directory.

The wider finding: a 1,633-listing directory that generates no revenue and that
only the admin can maintain. Everything needed to change that is built except
the claim.

**Parked 2026-07-31** with the design roughly 60% done — claiming, verification,
the two owner roles and the pending-change model are decided; what an owner may
edit and how a pending change is stored are not. Written up in
`docs/project-memory/TODO-business-claim-flow.md`.

The decision worth carrying: **there are two owner roles, not one** — ordinary
owners whose edits the admin confirms, and trusted owners whose edits go live.
That is precisely what `canAutoApproveBusinesses` was meant to be, so the toggle
we nearly deleted as dead becomes live the day this ships.

Related: [[business-owners-cannot-edit-their-listing]]
