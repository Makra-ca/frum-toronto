---
name: tagline-is-ads-copy-not-a-listing-field
description: Tagline stays the admin's copy for paid placements; owners edit description, which already does the job
type: decision
date: 2026-08-05
status: accepted
---

**Decision:** `businesses.tagline` is **not** an owner-editable field and gets no
work in the claim/edit project. It remains the admin's copy for paid placements.
Owners edit `description`.

**Context:** Measured, and every link in the chain is empty:

| | |
|---|---|
| Built for | homepage ads (`schema.ts:188`; the admin form still says so) |
| Homepage ads actually use | the banner image, not the tagline |
| Only code that renders it | newsletter shoutout block (`newsletter-renderer.ts:183`) |
| Shoutouts require | Elite, $120/mo |
| Businesses on Elite | **0** |
| Shoutouts ever created | **0** |
| Businesses with a tagline | **0** |

It is not badly designed — the feature it was built for changed shape and the
field survived the reorganisation with a form label describing the old plan.

**Chose over** making it the Free tier's one-liner. Tempting, because Free
displays almost nothing and tagline has no plan flag. Rejected because
`description` already fills that role: **1,072 of 1,635** businesses have one,
and `BusinessCard.tsx:94-96` already renders it truncated to 150 characters —
exactly what a tagline would have shown. Two 150-character fields doing one job
would force owners to learn which is which.

**Consequences:** two follow-ups, neither part of this project:

- The admin form claims the tagline "will appear in homepage ad placements". It
  does not. The text should say "used in newsletter shoutouts".
- **`BusinessCard` does not check the plan at all** — no reference to
  `showDescription` or the subscription. So a Free business's description shows
  in the directory listing and then disappears on its own detail page, which does
  gate it. That is backwards, and it quietly undercuts the upgrade pitch: the
  description a business would pay to unlock is already visible where most people
  look. Recorded as a decision to take, not taken here.

**The pattern worth carrying:** tagline is the seventh feature found in three
days that is built to the edge of usable and never connected — after Mux, the
homepage ads, the audit log, three permission toggles, the photo gallery and
`logoUrl`. Every one had **zero rows**. That is the cheapest possible check and
would have caught all seven before any design work.
