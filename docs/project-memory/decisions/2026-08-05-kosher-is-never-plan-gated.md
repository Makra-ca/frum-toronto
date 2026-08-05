---
name: kosher-is-never-plan-gated
description: show_kosher_badge is true on every plan; kosher status feeds a filter and a facet, so gating it emptied both
type: decision
date: 2026-08-05
status: accepted
---

**Decision:** Kosher status is collected and displayed on **every** plan,
including Free. `show_kosher_badge` set true on all four plans
(`migrations/2026-08-05-kosher-badge-all-plans.sql`, applied to primary and the
test branch), and the kosher section of the public submission form is no longer
wrapped in a plan check.

**Context:** `show_kosher_badge` was `false` on **all four** plans — Free,
Standard, Premium and Elite — from the day the column was added. So the kosher
section of the submission form rendered for nobody and the badge displayed on
nothing. Not a Free-tier problem: paying Elite customers could not mark
themselves kosher either.

It survived because the column defaulted off and was reachable only by raw SQL
until the plans admin UI gained capability toggles — the same failure mode as
[[dead-toggles-get-wired-not-removed]] and the still-off `show_video`. A
capability that defaults off and has no UI stays off silently and forever.

**Chose over:** enabling it on paid tiers only. Rejected on the audit's
reasoning rather than on sentiment about a frum directory: the **"Kosher only"
filter and the certification dropdown on `/directory/search` are built FROM
these columns** (`groupBy(kosherCertification)`). Gating them does not withhold
a badge from one listing — it strips options out of the directory's own filters
for every visitor. That makes kosher a findability field under
[[forms-collect-what-the-directory-needs]], not a display field.

**Consequences:**

- Every listing can now carry kosher status; the certification facet will start
  populating as submissions arrive.
- `show_kosher_badge` remains a real, editable flag. Turning it off for a plan
  hides the badge but no longer prevents entry — display and input are separate
  concerns now.
- The existing 1,635 listings are unaffected; their `is_kosher` values are
  whatever was already there.

Related: [[forms-collect-what-the-directory-needs]],
[[dead-toggles-get-wired-not-removed]], [[grant-permissions-through-the-ui-not-sql]]
