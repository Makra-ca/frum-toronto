---
name: stop-spec-review-when-errors-stop-changing-decisions
description: Spec review stopped at revision 12 because the remaining findings no longer changed any decision
type: decision
date: 2026-08-05
status: accepted
---

**Decision:** Adversarial review of the business claim spec stopped at **revision
12**, after six rounds, and the work moved to implementation planning.

**Context:** Every round found something, so "review until a round is clean" had
no obvious end. What changed was the *size* of the findings:

| Round | What it found |
|---|---|
| 1–2 | Wrong row counts, wrong write paths — **changed the design** |
| 3–4 | Wrong field write path, stale deploy status — **changed the scope** |
| 5–6 | A line number, a function name, two overstated negatives — **changed nothing** |

Some later findings existed only because earlier fixes created them — the tier
rule and the grandfathering rule were each fine alone and collided once both were
written down.

**Chose over** continuing until a round returned nothing. Rejected because the
plan is a stronger check than more prose: it turns each section into tasks with
tests that either pass or fail, where a review can only produce opinions.

**Consequences:** The stopping rule worth reusing: **stop when the errors stop
changing decisions**, not when they stop appearing. A review asked for findings
will produce findings.

One caveat recorded honestly — round six caught a revision-10 fix that had never
landed, because a string replace silently failed to match and I reported success
without checking. Every fix after that was verified against the file.
