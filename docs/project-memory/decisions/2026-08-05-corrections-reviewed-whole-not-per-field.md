---
name: corrections-reviewed-whole-not-per-field
description: A correction is approved or rejected as one thing; per-field review is kept for businesses only
type: decision
date: 2026-08-05
status: accepted
---

**Decision:** A correction to any of the eight submission types is reviewed
**whole** — approve or reject, with an optional reason on rejection. Per-field
review stays specified for business listings, and can be added here later
against the same table.

**Context:** Per-field was chosen first, for consistency with the business design
where it clearly earned its place: one submission carrying four good corrections
and one spam description. Review then showed the cost here — a per-field
comparison must render eight quite different content shapes (a davening-times
grid, mourner names, blog HTML and TipTap JSON, dates that break if handled as
instants, foreign keys shown as names). It was the largest and riskiest piece of
the whole build.

**Chose over** keeping per-field for consistency. Two things decided it:

- **An event correction is usually one field** — a time, a date, a phone number.
  The mixed-quality submission that justifies per-field is a business-listing
  shape, not a submission shape.
- **Rejecting no longer costs anything.** Once the live row is never overwritten,
  rejecting means "not this time, resubmit" rather than destroying the item. The
  elaborate salvage machinery existed to mitigate a problem the main fix removes.

**Consequences:** Roughly half the build, with the riskiest part gone. The
comparison view still shows old versus new; only the decision granularity
changes. Same table and same screen, so per-field is addable later without
redesign.

**The general point worth carrying:** fixing a root cause often dissolves
features that existed to mitigate it. Per-field looked necessary while rejection
was catastrophic. It stopped being necessary the moment it wasn't.

Related: [[corrections-are-proposals-not-overwrites]],
[[review-per-field-not-per-submission]]
