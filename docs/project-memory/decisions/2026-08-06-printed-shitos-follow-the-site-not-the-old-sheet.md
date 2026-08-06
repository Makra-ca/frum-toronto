---
name: printed-shitos-follow-the-site-not-the-old-sheet
description: Where the old sheet's halachic opinion differs from ours, the site's opinion wins and the heading says which
type: decision
date: 2026-08-06
status: accepted
---

**Decision:** The monthly zmanim sheet at `/zmanim/month` reproduces the old
FrumToronto sheet's *layout*, not its *shitos*. Where a column's halachic opinion
differs between the old sheet and what this site already computes, **the site's
value wins**, and the column heading names the opinion inline so the printed
number identifies itself.

Two columns differ today:

| Column | Old sheet | We print | Gap |
|---|---|---|---|
| Misheyakir | 11° | **10.2°** | ~6 min later |
| Sof Zman Shema (MA) | fixed 72 min | **16.1°** (`sofZmanShmaMGA16Point1()`) | ~15 min earlier |

**Do not "fix" either to match the old sheet.** Both were considered and decided.

**Context:** The site's zmanim were verified second-by-second against MyZmanim
across Toronto, New York and Jerusalem. MyZmanim agrees with us on both columns
above — it publishes Misheyakir as "Sun is 10.2 degrees below horizon" and Latest
Shema (MA) as "Using 72 minutes as 16.1 degrees". The old sheet used different
opinions for both. All four values are legitimate; they are simply different
poskim.

Printing the old sheet's values would mean the site shows two different Misheyakir
times and two different latest-Shema times on two of its own pages, for the same
morning. Printing ours means a reader of the old sheet sees those times move.
There is no option that changes nothing, which is why this needed a decision
rather than a default.

**Chose over:**

- *Match the old sheet exactly.* Rejected: it breaks the MyZmanim verification and
  makes the site self-contradictory between `/zmanim` and `/zmanim/month`.
- *Show both opinions as extra columns.* Offered against a rendered preview with
  real values, and declined on layout grounds — three Misheyakir columns spanning
  22 minutes read as a duplicate rather than as three shitos. Worth re-raising if
  the sheet is ever reviewed by a rav, because it is the only option that changes
  nobody's practice.

**Consequences:**

- **No rabbinic review was performed** — also a recorded decision. That makes the
  MyZmanim assertions in `tests/unit/zmanim-old-sheet-parity.test.ts` the *only*
  non-circular check on these two values. Comparing them to our own output would
  be circular; comparing them to the old sheet fails by construction. Do not
  delete that block.
- Both columns are **excluded from the old-sheet parity fixture** for the same
  reason. That exclusion is deliberate and documented in the fixture header.
- A guard test asserts Sof Zman Shema (MA) still differs from the old sheet's
  fixed-72-minute value by ~15 minutes, so a silent switch back goes red.
- Every heading carries its shita inline (`Misheyakir 10.2°`, `Alos 72 min`,
  `Tzeis 8.5°`). This is mandatory *because* there is no rabbinic review: a
  printed number on a wall must say which opinion it represents.
- The legend and the "Always verify times with your local Rabbi" disclaimer are
  forced to print. A pinned sheet of unexplained times is the worst outcome here.

**How this was found:** not by checking against MyZmanim, which agrees with us.
It surfaced only when our output, MyZmanim and the old sheet were laid side by
side and one column had two sources agreeing and the third dissenting. A single
reference validates arithmetic; it takes a second independent one to validate a
choice of opinion.
