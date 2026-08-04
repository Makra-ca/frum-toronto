---
name: business-owners-cannot-edit-their-listing
description: Three permission toggles do nothing; investigating why surfaced that business owners have no way to edit their own listing at all
type: decision
date: 2026-07-31
status: superseded
---

> **Superseded 2026-08-03** by [[dead-toggles-get-wired-not-removed]] on the
> toggles specifically. The reframe below still stands — the three are different
> problems, and business owners still cannot edit their listing. What changed is
> that leaving the toggles in place is no longer the answer.

**Decision:** The three dead toggles — Ask the Rabbi, Business Listings, Shul
Directory — are left in place for now rather than removed, because the
discussion showed they are not one problem but three different ones.

**Context:** All three appear in the admin permissions dialog, save correctly,
and are read by no code anywhere. Only `admin@frumtoronto.com` has them set, and
admins bypass these checks regardless, so nobody has ever been granted one
expecting it to work.

The instinct behind them — "a shul or business with permission should update
their own listing without approval, with an audit trail" — is right, and
checking it against the code produced three different answers:

- **Shuls already work exactly that way.** A manager edits name, address,
  rabbi, davening times and documents, it goes live with no approval, and the
  admin gets an in-app notification naming who changed what. That comes from
  being ASSIGNED to the shul, not from the toggle. What the toggle would mean
  is auto-approving a REQUEST to become a manager — handing over the keys, not
  using them, and a much riskier thing.
- **Businesses cannot be edited at all.** `/api/businesses/[id]` has only a
  GET; there is no PATCH, no PUT, and no edit page in the owner's dashboard.
  The only thing that can change a listing is the admin route. So the toggle
  would gate approval on an edit path that does not exist.
- **Ask the Rabbi** questions are answered, not approved. Auto-approve does not
  map onto anything real.

**Chose over:** removing all three from the dialog, which was the plan until
the reframe. Removing is still probably right, but doing it now would bury the
actual finding.

**Consequences:** The real gap is that **business owners have no way to
maintain their own listing** — a moved premises or changed phone number is an
email to the admin and a manual edit. Building it should follow the shul
pattern: edits live, admin notified. That is a feature, not a toggle.

Note `isTrusted` is set on 22 users and is the flag that actually affects
business creation; those 22 currently own zero businesses between them.
