---
name: owner-editor-matches-the-tier
description: A business owner's editor shows only the fields their plan displays publicly, accepting that a Free editor is thin
type: decision
date: 2026-08-04
status: accepted
---

**Decision:** The owner's editor shows **only the fields their subscription tier
displays publicly**. A Free owner edits phone, address, city, postal code, dining type and one
category. Description, email, website, hours, logo, social links **and contact
name** are not shown, because Free displays none of them.

**Corrected 2026-08-04:** an earlier version of this record listed contact name
and tagline as Free-editable. `show_contact_name` is false on Free, so contact
name is not; and tagline has no `show_*` flag at all and currently renders
nowhere on the listing, so whether it is editable depends on an open Part 0
decision.

**Context:** The tier design is from February 2026 — Free is name, address, phone
and one category; description, email, website, hours, map and logo are what
Standard sells at $27. The database matches the tier design, though not every field has a flag — see the correction below.

Until now that only governed **what the public sees**. This feature is the first
time it matters what an owner can *type into a form*, and those had silently been
treated as the same rule. Making it explicit was the point of the question.

**1,634 of 1,635 businesses are on Free**, so this is the editor almost every
owner gets on day one.

**Chose over:** showing every field with "displays on Standard and above" beside
the gated ones. That keeps the underlying data accurate and turns each gated
field into a live upgrade prompt while they type. Rejected because it invites an
owner to spend time on fields nobody will see.

**Consequences, accepted knowingly:** a Free listing's email and hours will go
stale, because the owner has no way to correct them and the admin is the only one
who can. That is the cost of the tier boundary being the editor boundary.

`maxCategories` is already enforced on write; the edit path copies that check.
Existing over-limit data is **grandfathered** — a business downgraded from
Standard to Free keeps its three categories, and the editor blocks adding more
rather than forcing a purge the owner cannot complete.
