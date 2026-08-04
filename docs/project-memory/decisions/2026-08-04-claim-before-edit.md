---
name: claim-before-edit
description: Business editing is built only after claiming, because an edit route serves nobody while listings have no owner
type: decision
date: 2026-08-04
status: accepted
---

**Decision:** Build claiming first, then owner editing, as one project. Only
approved listings can be claimed; the admin approves each claim by hand.

**Context:** Measured 2026-08-04 — 1,635 businesses, **2 with an owner**, 0
subscriptions ever created, and no owner-facing route for listing fields. The
paid directory was built and never launched, so 1,633 approved listings are a
directory the admin maintains by hand.

Both owned listings are **unapproved** (`pending_payment` and `pending`), which
turned "can an unapproved listing be claimed" from hypothetical into live data.

**Chose over:** building the edit route first, which was the obvious next step
after finding it missing. It would serve two people, both of whom own listings
that are not public yet.

**Consequences:** Claims are restricted to **approved** listings — an unapproved
or mid-payment listing belongs to whoever is paying, and letting a third party
claim it could hand ownership to someone who did not pay. Unapproved listings
404 publicly anyway, so there is nowhere to put the link. A genuine owner of an
unapproved listing is handled by **admin assignment**, which this project also
builds along with **revocation**; neither has any plumbing today.

Verification stays manual **(carried from 2026-07-31)**. Emailing a code to the
address already on the listing — 1,198 of 1,635 carry one — is the identified
upgrade and needs no schema change, which is why it is deferred rather than
designed now.

Related: [[business-claim-is-the-missing-step]], [[listing-stays-live-during-review]]
