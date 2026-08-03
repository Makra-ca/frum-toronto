---
name: group-only-when-it-earns-its-place
description: Series headings appear only once most series have a back catalogue
type: decision
date: 2026-08-02
status: accepted
---

**Decision:** The public page groups into named series only when **most** series
have more than one issue. Otherwise it renders the flat card grid.

**Context:** A heading is worth it when it collapses a back catalogue; over a
single card it is noise. The first rule was "any series has more than one issue",
and the live shul data broke it immediately — Ahavat Shalom has two newsletters
and four other shuls have one each, so one qualifying series switched grouping on
for the whole section: five headings, four of them above a lone card. Worse than
the grid it replaced.

**Chose over:** always grouping (consistent, but currently a regression) and
dropping shul grouping entirely (leaves half the findability problem unsolved).

**Consequences:** The heading a reader is looking for does not appear on a
series' first upload. It appears on the second. The `?publisher=` link works
from the first upload either way.

**Worth remembering:** the test for the first rule passed. It asserted the rule
that had been written rather than the outcome that was wanted, and the bug was
only visible by rendering the page.

Related: [[publisher-is-the-grouping-key]]
