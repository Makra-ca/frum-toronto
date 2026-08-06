---
name: no-zman-reaches-roundzman-pre-rounded
description: A zman handed to roundZman already at :00 seconds silently loses its rounding policy — two production bugs came from this
type: decision
date: 2026-08-06
status: accepted
---

**Decision:** No zman may reach `roundZman` (`src/lib/zmanim-format.ts`) already
rounded to a whole minute. Every value passed to it must carry real seconds.

The reason is four lines of `roundZman` itself:

```ts
const remainder = wholeSeconds % 60_000;
if (remainder === 0) return new Date(wholeSeconds);   // policy silently skipped
```

A value already at `:00` returns unchanged, so its entry in `ZMAN_DIRECTION` never
applies. **The existing coverage test does not catch this** — it asserts a
direction is *assigned*, never that it is *applied*.

**Context:** the same defect shipped to production twice, from two different
sources, and neither was caught by a test.

| Source | Symptom |
|---|---|
| hebcal pre-rounds its `Havdalah` event to the nearest minute | Havdalah and Tzeis 8.5° printed **different minutes for the same moment** on 5 of 10 consecutive Saturdays — on the same week card |
| `Zmanim.sunriseOffset(-45, true)` — the arg is named `roundMinute` but **truncates** | Misheyakir 45 min would print **a minute early on 31 of 31 days**, on an earliest-permitted time |

A third instance was caught before shipping: hebcal's `Fast begins`/`Fast ends`
event times are also pre-rounded, which would have printed "fast ends" a minute
**lenient**.

**Consequences:**

- `havdalah` is now the *same `Date` object* as `zmanim.tzait`, so the two are
  equal by construction rather than by coincidence. Verified across all 54
  havdalah events in 2026: hebcal's event is never more than 30 s from
  `tzeit(8.5)` — the rounding error and nothing more.
- `misheyakir45` uses `sunriseOffset(-45, **false**)`. Never change it to `true`.
- Fast times are computed from `Zmanim` (`alotHaShachar()`, `tzeit(7.083)`), not
  read off hebcal's events. An earlier draft justified using the events "so the
  sheet cannot disagree with the site" — that was false: `Fast begins`/`Fast ends`
  appear nowhere else in `src/`.
- `tests/unit/zmanim-new-zmanim.test.ts` holds an **invariant** test that iterates
  every key of `ZmanimTimes` and fails any that is systematically pre-rounded. It
  covers future additions automatically — but only if the new zman is added to the
  interface rather than computed outside it.
- **Sanity check when adding any zman:** does the value carry seconds? If a
  library helper offers a "round" argument, decline it and let `roundZman` own
  rounding. The direction matters — deadlines round down, permitted-from times
  round up — and it is silently forfeited otherwise.

**Chose over:** making `roundZman` throw on a pre-rounded input. Rejected because
a genuine `:00` occurs by chance about 1 day in 60, so it would produce false
alarms; the invariant test discriminates by frequency (>3 occurrences in a month)
instead.
