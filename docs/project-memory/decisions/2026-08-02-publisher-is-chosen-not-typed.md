---
name: publisher-is-chosen-not-typed
description: The publisher field is a select with an explicit "new publisher" step, and renames are exact
type: decision
date: 2026-08-02
status: accepted
---

**Decision:** Publisher is a dropdown of names already in use. Reusing one
involves no keyboard. Introducing a new one is a separate `+ New publisher`
option that reveals a text box. A rename endpoint fixes a typo across every
issue of a series in one action, matching **exactly**.

**Context:** Free text with a datalist made the right name easy to pick but did
nothing to stop the wrong one being typed. A typo splits an archive in half
silently — and the link already sent to readers then shows a subset with no way
for them to tell anything is missing.

**Chose over:** fuzzy matching on similarity. "Israel News" and "Israeli News"
may be two real publications; merging them automatically gives wrong data rather
than incomplete data, which is harder to spot and worse to unpick. A unit test
pins them as separate series so nobody later "fixes" this.

**Consequences:** Adding a publisher costs one extra click. The rename endpoint
is built and tested but has no UI yet — a typo is recoverable through the API,
not from the admin screen.

Related: [[publisher-is-the-grouping-key]]
