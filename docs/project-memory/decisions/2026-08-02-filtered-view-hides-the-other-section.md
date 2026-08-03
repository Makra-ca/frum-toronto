---
name: filtered-view-hides-the-other-section
description: A series link shows that series alone, and an unknown slug is an empty state rather than a 404
type: decision
date: 2026-08-02
status: accepted
---

**Decision:** `?publisher=` and `?shul=` show that series only — the other
section is hidden entirely. An unknown slug renders an empty state with a link to
the full list, never a 404. A filtered view is uncapped.

**Context:** These URLs are the reply to the readers who wrote in. A link that
renders Israel News *plus* six parsha sheets from other shuls is close to the
state they complained about.

**Chose over:** narrowing only the matching section and leaving the other full,
which the first draft did. Section visibility is computed from the filtered
series rather than the raw rows for exactly this reason — reading the raw arrays
left an unknown slug rendering bare headings above a full list.

**Consequences:** These links go into emails and outlive a publisher being
renamed, so a 404 would be the wrong answer to a link that used to work. The
uncapped filtered view is what makes "See all issues" meaningful; capped, it
would link to itself with the older issues still unreachable.

Related: [[publisher-is-the-grouping-key]]
