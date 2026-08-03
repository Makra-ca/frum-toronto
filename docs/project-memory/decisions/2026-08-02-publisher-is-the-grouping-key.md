---
name: publisher-is-the-grouping-key
description: A newsletter series is defined by its publisher string, not a category record
type: decision
date: 2026-08-02
status: accepted
---

**Decision:** `community_newsletters.publisher` is the grouping key. Typing
"Israel News" creates the series, its heading and its URL. There is no category
table and no setup step.

**Context:** Three readers wrote in asking where "Israel News" had gone. It had
not gone anywhere — the feature to host it existed, was linked in the nav twice,
and had zero rows. But the page organised by date while readers searched by
name, so even once stocked there was no heading carrying the name and no link to
send them.

**Chose over:** a `publishers` table with a foreign key. That makes drift
impossible by construction and renaming a single edit, but it needs a migration,
a backfill, CRUD screens, and it turns the grouping key from a string into a
relation — a lot of machinery for what will realistically be two or three
publishers.

**Consequences:** The string is the identity, so a typo creates a second series
rather than an error. Mitigated by [[publisher-is-chosen-not-typed]]. Shul
newsletters group by the shul record instead and cannot have this problem.

Related: [[publisher-is-chosen-not-typed]], [[group-only-when-it-earns-its-place]]
