---
name: everything-stays-live-during-review
description: One rule for all content — an item never leaves the site because someone corrected it
type: decision
date: 2026-08-05
status: accepted
---

**Decision:** Every content type keeps its item **visible** while a correction
waits. No exceptions.

**Context:** Today an item goes offline the moment a correction is submitted, for
every type, and stays off until the admin gets to it. Blog additionally had a
deliberate rule of its own that editing unpublishes
([[blog-adopts-unpublish-rule]], 2026-07-31).

**Chose over** keeping blog dark on edit, which would have preserved the July
decision. Rejected because it means two rules to explain and two code paths, for
no benefit once the live row is never overwritten.

**Consequences:** **Supersedes [[blog-adopts-unpublish-rule]]**, whose reasoning
no longer applies — that rule existed because an edit destroyed the approved
version, which this design prevents outright.

The accepted cost: a correction can wait indefinitely with the **wrong version
live**. For a classified that is harmless; for a shiva notice with a corrected
levaya time it is not. Softening options (flagging time-sensitive types, or
letting shiva corrections apply immediately) were offered and declined in favour
of one rule. Still better than today, where the notice disappears entirely.
Revisit if it bites.
