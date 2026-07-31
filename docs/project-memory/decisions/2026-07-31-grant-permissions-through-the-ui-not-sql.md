---
name: grant-permissions-through-the-ui-not-sql
description: Missing permission controls are added to the admin panel rather than granted by direct database writes
type: decision
date: 2026-07-31
status: accepted
---

**Decision:** `canAutoApproveBlog` was added to the admin permissions dialog AND
to the users PATCH route, so Daniel grants it himself. No production data was
written by the assistant.

**Context:** Blog is 99% of the submissions feature and its main author owns
1,395 published posts as a plain member. Under the unpublish rule every typo fix
would take a live post off the site until the site's single admin approved it.
The obvious fix was to set her flag directly in the database.

**Chose over:** a direct UPDATE on production users. That would have solved one
person's problem and left the control still missing, so the next author needs an
engineer again.

**Consequences:** Both halves were required — the route destructures named
fields, so adding the switch alone would have flipped it, dropped it, and still
shown a success toast. A route-level test now drives itself from the real
columns, so a flag added to the schema and forgotten in the route fails rather
than shipping as a switch that does nothing.

Related: [[blog-adopts-unpublish-rule]]
