---
name: bare-legacy-times-are-pm
description: A legacy event time with no am/pm is imported as PM, and a trailing meridiem applies to the whole range
type: decision
date: 2026-08-06
status: accepted
---

**Decision:** In `scripts/migrate-events.js`, `parseTimeString` now (a) applies a
meridiem written once at the END of a range to every time in that range, and
(b) treats a bare hour of 1–11 with no am/pm anywhere as **PM**. An explicit
`am` is always honoured.

**Context:** Backfilling 25 events from the legacy `Diary` table, the dry run
showed four about to be published at the wrong time of day:

| old id | event | stored `eTime` | would have imported |
|---|---|---|---|
| 7338 | Bnos Bais Yaakov PTA | `6:00-10:00 pm` | **6:00 AM** |
| 7324 | TTC PTA | `6:00-10:00` | **6:00 AM** |
| 7304 | Kollel Oholei Yom Tov **Melave Malkah** | `9:00` | **9:00 AM** |
| 7318 | Philadelphia Yeshiva Parlor Meeting | `9:00` | **9:00 AM** |

Two distinct faults. 7338 is a **real bug**: the regex
`(\d{1,2}):?(\d{2})?\s*(am|pm|...)?` only attaches a meridiem to the token it
directly follows, so in `"6:00-10:00 pm"` the leading `6:00` matched with an
empty meridiem group and fell through to AM. Nothing ambiguous about it — the
string says pm.

The other three are ambiguous at source; the old site simply stored `"9:00"`.
The parser's silent default was AM, which is the wrong prior for a community
calendar. A melave malkah is by definition Motzei Shabbos.

**Chose over:**

- *Import the ambiguous ones as all-day.* Honest — it shows no time rather than
  a possibly wrong one — but it discards information that is nearly always
  recoverable, and an all-day PTA is its own kind of wrong.
- *Leave them and fix by hand afterwards.* Three rows is tractable, but the rule
  has to exist anyway for the next import, and hand-editing is unrecorded.

Evening is not a guess so much as a base rate: of the 25 events in this batch,
every one with an explicit meridiem except two (a morning charity ride and a
golf tournament, both of which say `AM`) is PM.

**Consequence — the same bug is in the existing rows.** The 44 events imported
in February 2026 went through the unfixed parser, so an unknown number carry a
wrong time. Deliberately NOT corrected in this pass (owner's call: "not now but
please record this bug"). Auditing them means re-reading each row's legacy
`eTime` and comparing against the stored instant; the legacy row is still
reachable through `events.old_id`, so nothing is lost by waiting.

**Verified:** 14 parser cases pinned before re-running, including that
`"9:00 AM"` and `"8am"` stay morning — the regression that would matter most.
Post-import spot checks confirm new rows follow the same UTC-instant convention
as the February rows (ev110 `8:00pm` Oct 14 -> stored `2026-10-15 00:00`, i.e.
20:00 EDT + 4h, identical in shape to ev37 from February).
