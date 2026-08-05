---
name: business-work-split-into-two-plans
description: Finishing the business fields is its own plan, ahead of claiming and owner editing
type: decision
date: 2026-08-05
status: accepted
---

**Decision:** The business claim spec becomes **two** implementation plans:
`2026-08-05-finish-business-fields` (Part 0) and
`2026-08-05-business-claim-and-owner-editing` (Parts 1–3). The first must ship
before the second.

**Context:** Measuring the fields rather than reading `schema.ts` showed four of
the six editable groups do not work: `logoUrl` has no write path anywhere (0 of
1,635 rows), and `contactName`, `socialLinks` and `additionalCategoryIds` are
create-only — set at registration, then unchangeable, because the admin update
omits the keys.

**Chose over** one plan covering everything. The split holds because Part 0 is
**independently valuable**: today the admin cannot set a logo on any business
through any route, so finishing the fields improves the directory whether or not
owner editing ever ships. It is also the only part with a user today — Daniel.
Parts 1–3 serve business owners, of whom there are two, both on unapproved
listings.

**Consequences:** Part 0 is a prerequisite with no owner-facing value of its own,
which is the kind of work that gets cut under pressure later. It is load-bearing:
without it the editor offers a logo nothing can store, which would be the
photo-gallery mistake repeated four times.

Related: [[claim-before-edit]], [[images-are-logo-and-banner-only]]
