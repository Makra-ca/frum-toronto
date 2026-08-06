# Zmanim Month Sheet — Design

**Date:** 2026-08-05
**Status:** Approved (pending spec review)
**Origin:** Support ticket — *"Do you still have a zmanim calendar for the entire month?"* referring to https://frum-toronto.vercel.app/zmanim

---

## 1. Problem

The old FrumToronto site published a month-at-a-glance zmanim sheet: one row per civil
day, **twenty columns — four identity columns and sixteen times** — printed and pinned up
in shuls. Our sheet has twenty-one: the same four identity columns and seventeen times
(the sixteen plus one addition, §9.2). The current `/zmanim` page has **no month view at
all**.

What exists today:

- `getZmanimForWeek()` in `src/lib/zmanim.ts` is the only multi-day function.
- `/api/zmanim` supports `mode=today | week | shabbat`.
- The `«` / `»` buttons on `/zmanim` jump *by* a month but still render seven day-cards.

A user also reported seeing the location name repeated on the page. It renders three
times, not two: `ZmanimPageContent.tsx:184-186` (the `<h1>`), `:187-190` (a `<p>` with a
pin icon), and again inside `LocationPicker.tsx:247`.

## 2. Goals

1. A faithful reproduction of the old month sheet — dense table, all columns, printable.
2. Selectable span: a calendar month by default, or any custom range up to 31 days.
3. Shareable and printable: a shul can link a specific sheet and pin up the result.
4. Zero change to the existing week view, which is already verified against MyZmanim.

## 3. Non-goals

- Redesigning or "modernising" the week view.
- A calendar-grid (month-of-boxes) layout. The use case is scanning one column down
  31 days; a grid is the worst format for that.
- Mobile-first prettiness. This is a wall chart. It scrolls horizontally on a phone.
- Spans longer than 31 days.

---

## 4. User-facing behaviour

`/zmanim` gains a two-option view toggle:

```
[ Week view ] [ Calendar sheet ]
```

**Week view** is today's page, unchanged, and remains the default.

**Calendar sheet** renders the dense table. Its controls:

- Primary: `[ Month ▾ ] [ Year ] [ Go ]` plus `‹` / `›` arrows — the old site's control.
- Secondary: a **Custom range** toggle revealing `from` and `to` date inputs.
- Default span: the current calendar month in the selected location.

Today's row is highlighted, matching the old sheet's blue row.

### Why span defaults to a calendar month

An arbitrary range is supported, but the month is the anchor because:

1. A wall chart is *"August 2026"*. `Aug 3 – Sep 2` is a strange artifact to pin up.
2. The two footnotes (Molad, Sof Zman Kiddush Levanah) are Hebrew-month events. They
   work correctly in any range — you print whichever fall inside it — but the month
   framing is what makes them read naturally.
3. A shul linking to the sheet wants a URL that shows *the current month*, not a range
   frozen in 2026.

---

## 5. Table structure

### 5.1 Left block (four columns)

| Column | Content |
|---|---|
| Yom Tov · Parsha · Daf Yomi | Parsha on Shabbos rows; **all** applicable holiday/Rosh Chodesh/fast labels; Daf Yomi on every row |
| Day | Single letter — `S M T W T F S` |
| Civil day | Day number under a month heading |
| Hebrew date | e.g. `18 Av` |

**No column can be sourced *completely* from `ZmanimResponse` as it exists today.** The
parsha is available (`ZmanimResponse.parsha`), but the labels and Daf Yomi that share its
column are missing outright, and the day letter, day number and Hebrew date exist only
inside pre-formatted English strings. See §6.7.

### 5.2 Time columns (seventeen)

`Status` below means **new to our codebase**, not new versus the old sheet — every column
except #8 appeared on the old sheet. That is how the counts in §1 hold.

| # | Column heading | Source | Status |
|---|---|---|---|
| 1 | Alos 16.1° | `Zmanim.alotHaShachar()` | exists |
| 2 | Alos 72 min | `Zmanim.alotHaShachar72()` | **new** |
| 3 | Misheyakir 10.2° | `Zmanim.timeAtAngle(10.2, true)` | exists — see §9.1 |
| 4 | Misheyakir 45 min | `Zmanim.sunriseOffset(-45, true)` | **new** |
| 5 | Haneitz Hachama | `Zmanim.sunrise()` | exists |
| 6 | Sof Zman Shema (MA) | `Zmanim.sofZmanShmaMGA16Point1()` | exists |
| 7 | Sof Zman Shema (Gra) | `Zmanim.sofZmanShma()` | exists |
| 8 | Sof Zman Tefilah (MA) | `Zmanim.sofZmanTfillaMGA16Point1()` | exists — see §9.2 |
| 9 | Sof Zman Tefilah (Gra) | `Zmanim.sofZmanTfilla()` | exists |
| 10 | Chatzos Hayom | `Zmanim.chatzot()` | exists |
| 11 | Mincha Gedolah | `Zmanim.minchaGedola()` | exists |
| 12 | Mincha Ketana | `Zmanim.minchaKetana()` | exists |
| 13 | Plag Hamincha | `Zmanim.plagHaMincha()` | exists |
| 14 | Candle Lighting | hebcal `CandleLightingEvent` | exists |
| 15 | Shkias Hachama | `Zmanim.sunset()` | exists |
| 16 | Tzeis 8.5° | `Zmanim.tzeit(8.5)` | exists |
| 17 | Tzeis 72 min | `sunset() + 72 clock minutes` | exists |

The old sheet had no separate Havdalah column because havdalah *is* Tzeis 8.5° in our
system (`zmanim.ts` uses `havdalahDeg: 8.5`). No column is needed.

That was true of the underlying moment but **was not true of the printed number** until
`e78c6dc`. hebcal pre-rounded its Havdalah event to the nearest minute while `tzeit(8.5)`
was rounded up, so five of ten consecutive Saturdays showed two different minutes for the
one moment — on the same week card. `havdalah` is now the same `Date` object as `tzait`,
so the Tzeis 8.5° column and the site's havdalah agree by construction. **The sheet must
read the column from `zmanim.tzait` and must not re-derive it from a hebcal event.**

### 5.2.1 Fast days need two columns the seventeen do not provide

hebcal emits `Fast begins` and `Fast ends` events, and **`Fast ends` is `tzeit(7.083°)`,
which is not among the seventeen columns.** For Tzom Gedaliah 2026 the site publishes
20:04, while the sheet's nearest offerings are Tzeis 8.5° = 20:12 and Tzeis 72 = 20:41 —
8 and 37 minutes late.

The fast *start* is worse, because the sheet is actively misleading rather than merely
incomplete. The fast begins at Alos 16.1° (05:28:51), but the adjacent **Alos 72 min**
column reads 05:43:50 — about fifteen minutes later. §5.1 labels the row "Tzom Gedaliah"
and nothing indicates which of the two Alos columns applies, so a reader scanning the
wrong one eats a quarter of an hour into the fast.

Resolution: two dedicated **Fast begins / Fast ends** values on fast-day rows, sourced from
the hebcal events so the sheet cannot disagree with the site. Rendered via §5.3's footnote
mechanism rather than as two more columns that are empty 360 days a year.

**Yom Kippur is different:** hebcal emits no `Fast begins`/`Fast ends` for it, using Candle
lighting and Havdalah instead — both of which the sheet already has columns for.

Candle lighting is blank on every row except Fridays and Yom Tov eves. Hebcal applies
the **local** custom by coordinate with no configuration from us — 18 min in Toronto,
40 in Jerusalem, 30 in Haifa — so the heading reads `Candle Lighting`, not
`Candle Lighting 18 min` as the old Toronto-only sheet did.

### 5.3 Inline footnote rows

Two full-width rows are inserted between day rows at their correct date, as the old
sheet does:

- **Molad** — `The Molad for Elul will take place: Thursday 8:15 AM + 0 Chalakim - August 13`
- **Sof Zman Kiddush Levanah** — `Sof Zman Kiddush Levanoh: Friday 2:37 AM + 0 Chalakim`

Placement rule: each is inserted immediately after the day row on which it falls. If a
footnote's date lies outside the requested range, it is omitted.

---

## 6. Computation

### 6.1 Two new zmanim

`alotHaShachar72` and `misheyakir45` are added to the `ZmanimTimes` interface in
`src/lib/zmanim.ts`.

> **`misheyakir45` MUST be `sunriseOffset(-45, false)`, not `(-45, true)`.**
>
> That second argument is named `roundMinute`, but it **truncates** seconds rather than
> rounding. A truncated value arrives at `roundZman` already sitting at `:00`, and
> `roundZman` returns early on a zero remainder — so the `"up"` direction below never
> applies and the column prints **a minute early on every row whose seconds are non-zero**
> (measured: 8 of 8 consecutive days in August 2026). Misheyakir is the earliest time one
> may put on tallis and tefillin, so early is the unsafe direction.
>
> ```
> 2026-08-01  true 05:21:44   with `true` → 5:21 AM      with `false` → 5:22 AM
> 2026-08-04  true 05:24:59   with `true` → 5:24 AM      with `false` → 5:25 AM
> ```
>
> `alotHaShachar72()` takes no such argument and is verified to be exactly fixed 72 clock
> minutes before sunrise (0 ms deviation at both solstices), so it is safe as written.

**The general invariant, which this is one instance of:** no zman may reach `roundZman`
already rounded, or its entry in `ZMAN_DIRECTION` becomes decorative. The identical defect
shipped to production via hebcal's pre-rounded Havdalah event and was fixed separately in
`e78c6dc`; `tests/unit/zmanim-havdalah-consistency.test.ts` now guards the invariant. Any
new zman added to the sheet must be checked against it — the existing `ZMAN_DIRECTION`
coverage test asserts a direction is *assigned*, never that it is *applied*, and passed
throughout both bugs.

Both are permitted-from times, so both get `"up"` in `ZMAN_DIRECTION`
(`src/lib/zmanim-format.ts`). The existing test at
`tests/unit/zmanim-rounding.test.ts:82-88` asserts every key has a direction, so omitting
one fails the suite rather than silently defaulting.

**Note on that guard's reach:** the test iterates the **runtime object** returned by
`getZmanimForDate`, not the TypeScript interface. Adding a field to `ZmanimTimes` without
populating it would therefore not trip the test. Populate and register in the same commit.

**Ripple check (verified, not assumed):** the week cards in `ZmanimPageContent.tsx`
list their rows explicitly (lines 337–350), so they will *not* grow two new rows.
`ZmanimPageContent` also declares its **own** local `ZmanimDay` interface (lines 27–52)
duplicating the zmanim shape; it is structurally typed against the API JSON, so extra
fields are ignored rather than breaking it. Left as-is — deduplicating it is unrelated
refactoring.
`/api/zmanim` builds its response with `Object.fromEntries(Object.keys(...))` for both
`mode=today` and `mode=week`, so both responses gain two additive fields. No existing
consumer reads by index or iterates the response for display.

### 6.2 Daf Yomi — the one genuinely risky part of this spec

Requires a new dependency, `@hebcal/learning@6.9.7`, which registers schedules into the
`DailyLearning` static registry already exported by core (`DailyLearning.addCalendar` /
`.lookup`, confirmed in `dist/DailyLearning.d.ts`).

**The risk is not the API. It is the transitive upgrade.** `@hebcal/learning@6.9.7`
requires `@hebcal/core@^6.9.1`; this project has **6.0.6** installed. Because
`package.json` specifies `^6.0.6`, which permits 6.9.1, npm **dedupes by upgrading rather
than nesting a second copy**. Measured with `npm install @hebcal/learning@6.9.7 --dry-run`:

```
add    @hebcal/learning 6.9.7
change @hebcal/core      6.0.6  => 6.9.1
change @hebcal/hdate     0.21.1 => 0.22.7
change @hebcal/noaa      0.9.2  => 0.12.2
change temporal-polyfill 0.3.0  => 1.0.3
```

`@hebcal/noaa` is the **solar-position library that computes every zman on this site**, and
it jumps nine minor versions on a pre-1.0 package. That looked alarming enough to reorder
this entire spec around gating it.

**It was measured, and it is a non-issue.** Both versions were installed side by side in a
scratch directory and diffed:

| Surface | Values compared | Differences |
|---|---|---|
| zmanim — 366 days × Toronto + Jerusalem × 15 times | 10,980 | **0 displayed minutes** (2 raw values moved 1 s) |
| calendar — 731 days × `HDate`, `gematriya`, `OmerEvent`, `HebrewCalendar`, `flags` | 5,848 | **0** |

That covers every `@hebcal/core` API this codebase uses; there are exactly nine import
sites and all are represented. **Take the upgrade.**

Two lessons worth keeping, because both are cheap to repeat:

1. A version delta is not a risk measurement. Three pages of mitigation were written here
   from `0.9.2 → 0.12.2` before anyone ran the comparison, which took ten minutes.
2. "The diff found value changes" is not a finding without a magnitude. Two values moved by
   one second; nothing a reader can see changed at all.

**There is no middle option, should the upgrade ever need reverting.**
`@hebcal/learning` declares `@hebcal/core@^6.9.1` as a hard dependency, not a peer, so
"import Daf Yomi from it while pinning core at 6.0.6" forces npm to nest learning's own
core 6.9.1. `DailyLearning` is a **static registry**, so learning would register into the
nested core while the app reads from the top-level one — `lookup()` returns `null` and
nothing throws. Taking the package means taking the upgrade; the only alternative is
computing Daf Yomi standalone from the fixed cycle epoch (2020-01-05, Berachos 2) over a
static masechta-length table.

One unknown remains, confirmed by a short spike before the column is built:
`DailyLearning.lookup("dafYomi", hd, il)` must return `Chulin 93` for 2026-08-01.

**Regression gate.** Re-run the existing zmanim suite plus a **self-snapshot diffed at zero
tolerance** — not the old-sheet fixture. §11.1's fixture carries a ±1 minute tolerance for
rounding, which is precisely the size of change this upgrade would produce, so it cannot
serve as the gate. Parity testing and regression testing need different tolerances; see
§11.1.

### 6.3 Molad

`new Molad(year, month)` — note the constructor takes **year and month numbers, not an
`HDate`**; passing an `HDate` returns `NaN` from every getter without throwing.

Verified against the old sheet:

```
hebcal Molad(5786, months.ELUL)  →  dow 4, hour 8, min 15, chalakim 0
                                    render: "Molad Elul: Thursday, 8:15am"
old sheet                        →  "Thursday 8:15 AM + 0 Chalakim - August 13"
```

`Molad` exposes day-of-week, hour, minute and chalakim only — **not** a civil date. The
civil date is derived: take the Gregorian date of 1 of that Hebrew month, then walk back
**0 to 6 days** to reach the molad's day-of-week.

**Zero is a real case and must be included.** If the molad falls on the same weekday as
Rosh Chodesh, the answer is Rosh Chodesh itself; reading the rule as "the *preceding*
occurrence" would go back a full seven days and print a date one week early. Measured
across 247 Hebrew months (5780–5799), the distribution of `(roshChodeshDow - moladDow) mod 7`
is:

```
0 days: 9 months (3.6%)   1 day: 98   2 days: 114   3 days: 26   4-6 days: 0
```

So the zero case occurs roughly one month in 28, and the walk never exceeds three days.
A footnote wrong by a week, on a sheet pinned up in a shul, is exactly the kind of defect
that gets noticed by a reader rather than by us. §11.2 requires a test for a
zero-distance month specifically.

**The molad time is deliberately not converted to the viewer's timezone.** It is stated
in the traditional fixed reckoning. Hebcal prints `8:15am` and so did the old ASP site,
in Toronto. This is the one time on the entire sheet that is intentionally not local,
and it must carry a code comment saying so, or a later reader will "fix" it as a
timezone bug.

### 6.4 Sof Zman Kiddush Levanah

Not available in `@hebcal/core`. New pure module `src/lib/kiddush-levana.ts`.

The shita was **derived from the old sheet's own printed numbers rather than chosen**:

```
molad Elul 5786          = Thu 2026-08-13 08:15
+ 14d 18h 22m 1 chelek   = Fri 2026-08-28 02:37:03
old sheet                = "Sof Zman Kiddush Levanoh: Friday 2:37 AM + 0 Chalakim"
```

An exact match, so the old site used the halfway-point (Rema) reckoning.

**Encode the constant literally: `14d 18h 22m + 1 chelek`, where one chelek is 3⅓ seconds
(3333⅓ ms).** Do *not* derive it as "half a lunar month" — half of 29d 12h 44m 3⅓c is
14d 18h 22m **1.667s** (half a chelek), which is 1.67 s away from the constant that
reproduces the fixture. Immaterial to the displayed minute, but an implementer deriving it
from first principles would get a different number than the one verified above.

**Chalakim rendering:** the computed value carries 1 chelek, while the old sheet prints
`+ 0 Chalakim`. The old site displayed the chalakim of the *molad*, not of the derived sof
zman. We do the same — the `+ N Chalakim` suffix on both footnote lines comes from
`Molad.getChalakim()`, so both lines agree with the old sheet.

### 6.5 `kiddush-levana.ts` owns every `Molad` and `HDate` construction

Both footnote lines (§5.3) need the molad's weekday, hour, minute **and** chalakim, plus
its civil date and the derived sof zman. So this module's interface is the rendered lines,
not raw parts:

```ts
export interface MoladFootnotes {
  monthName: string;           // "Elul"
  moladCivilDate: Date;        // 2026-08-13, per the §6.3 walk-back
  moladLine: string;           // "The Molad for Elul will take place: Thursday 8:15 AM + 0 Chalakim - August 13"
  sofZmanCivilDate: Date;      // 2026-08-28
  sofZmanLine: string;         // "Sof Zman Kiddush Levanoh: Friday 2:37 AM + 0 Chalakim"
}

/** Every footnote whose date falls inside [from, to], already ordered. */
export function moladFootnotesInRange(from: Date, to: Date): MoladFootnotes[];
```

Taking a civil range rather than a Hebrew month keeps `HDate` in here too — otherwise
`zmanim-sheet.ts` would need it to work out which Hebrew months the range spans.

**This is the point: `Molad` is constructed in exactly one module.** §6.3's trap — the
constructor takes `(year, month)` numbers, and passing an `HDate` returns `NaN` from every
getter *without throwing* — then has one place to go wrong instead of two.

### 6.6 Range function

`getZmanimForRange(from: Date, to: Date, location: ZmanimLocation): ZmanimResponse[]`
joins `getZmanimForDate` and the existing noon-UTC anchoring helpers in
`src/lib/zmanim-day.ts`. It uses `addAnchoredDays`, never `setDate`, so days stay pinned
at exactly 12:00 UTC across a DST transition.

`getZmanimForWeek` is left in place and unchanged.

### 6.7 The sheet's row input type

`getZmanimForRange` returns `ZmanimResponse[]`, which **cannot supply the left block**.
Four concrete gaps, all verified against `src/lib/zmanim.ts`:

1. **Rosh Chodesh is never captured.** `getZmanimForDate` sets `specialDay` only for
   `flags.CHAG`, `MINOR_HOLIDAY`, `MINOR_FAST` and `MAJOR_FAST` (lines 140–147).
   `flags.ROSH_CHODESH` is not among them, so a Rosh Chodesh row would render blank —
   yet the old sheet labels those rows, and §5.1 requires it.
2. **`specialDay` is a single string, last-write-wins** over the event loop. A day that is
   both Rosh Chodesh and Chanukah collapses to one arbitrary label. The sheet's densest
   column is precisely the one needing several labels per row.
3. **Daf Yomi has no home in the type at all.**
4. **No machine-readable date.** For 2026-08-13, `ZmanimResponse.date` is a
   *locale-formatted English string* (`"Thursday, August 13, 2026"`) and `hebrewDate` is
   `HDate.toString()`, which **includes the year** (`"30 Av 5786"`). The sheet needs a day
   letter, a bare civil day number and `30 Av` — deriving those would mean string-parsing
   inside the component, contradicting §7's "no date arithmetic in the component".

Resolved by an explicit type, so the sheet's units have a stated interface rather than an
implied one:

```ts
// src/lib/zmanim-sheet.ts
export interface SheetRow {
  kind: "day";
  date: Date;                  // the anchored civil date — drives day letter + day number
  hebrewDateShort: string;     // "30 Av", year stripped
  zmanim: ZmanimResponse;      // all times + parsha
  labels: string[];            // ALL applicable: Rosh Chodesh, Yom Tov, fast days
  dafYomi: string | null;      // null when the column is disabled (§6.2)
  isToday: boolean;            // per §6.8
}

export interface FootnoteLine {
  kind: "footnote";
  text: string;                // the fully rendered Molad / Sof Zman Kiddush Levanah line
}

/** What ZmanimSheet.tsx renders, in order. */
export type SheetLine = SheetRow | FootnoteLine;
```

`buildSheetLines()` returns `SheetLine[]` — already ordered, with footnotes interleaved at
their correct positions. The component maps over it and switches on `kind`; it makes no
placement decisions of its own.

`labels` is built by a new exported helper in `zmanim.ts` that returns every matching
event description for a date, including `flags.ROSH_CHODESH`. **`specialDay` on
`ZmanimResponse` is left exactly as-is** — it is consumed by the week view and the API,
and changing its shape would ripple into both for no benefit here.

### 6.8 "Today" is resolved in the location, not on the server

`ZmanimSheet` is a server component, so `new Date()` inside it is the **server's** clock —
UTC on Vercel. `isToday` must come from `todayInLocation(location)` in
`src/lib/zmanim-day.ts`.

This is not a hypothetical: the project has shipped two production bugs from exactly this
confusion, and `zmanim-day.ts` exists because of them.

The page must also stay dynamic rather than being prerendered at build time with a frozen
"today". Reading `searchParams` achieves this today (`next.config.ts` has no
`cacheComponents`), and `page.tsx` also carries an explicit
`export const dynamic = "force-dynamic"` so the guarantee survives a future Cache
Components opt-in rather than depending on one config flag staying unset.

> **This has a cost that falls on the week view, and it is an argument against the shared
> route.** Route segment config applies to the **whole segment**. Both views share
> `/zmanim/page.tsx`, and that page is **static today** — verified: no dynamic export, a
> static `metadata` object, a synchronous component wrapping a client component that
> fetches. Adding `force-dynamic` for the sheet's benefit therefore makes the week view
> dynamic too, for no gain to it.
>
> A separate `/zmanim/month` route removes the problem entirely: each segment gets its own
> config. This was not known when the shared-route decision was taken. **Open item, §14.**

### 6.9 Measured performance

Benchmarked on this machine against the real library:

```
HebrewCalendar.calendar() x31 (per day)     2.02 ms/month
HebrewCalendar.calendar() once for range    1.22 ms/month
zmanim solar math only, 5 zmanim x31       15.43 ms/month
full 17-column month, 31 days              ~34    ms/month
```

The cost is the **solar math**, scaling with column count — not the calendar lookups, as
was initially assumed. ~34 ms per month is negligible server-side, so performance places
no constraint on the design and no caching layer is warranted.

Note that batching `HebrewCalendar.calendar()` once for the whole range is ~40% cheaper
than the per-day call, but §6.6 specifies `getZmanimForRange` as a loop over
`getZmanimForDate`, which calls it per day. That is a **deliberate choice** — the
0.8 ms/month saving is not worth a second code path diverging from the well-tested
single-day function. The measurement is recorded here only so a later reader does not
mistake the unused figure for the design.

---

## 7. Architecture

```
src/lib/zmanim.ts                 + alotHaShachar72, misheyakir45
                                  + getZmanimForRange(from, to, location)
                                  + labelsForDate(date, location) → string[]
src/lib/zmanim-format.ts          + 2 entries in ZMAN_DIRECTION
src/lib/zmanim-location-params.ts NEW  parseLocationParams + …OrToronto (§8)
src/lib/kiddush-levana.ts         NEW  pure; both footnote lines for a date range (§6.5)
src/lib/zmanim-sheet.ts           NEW  pure; SheetLine[] — rows + interleaved footnotes
src/lib/zmanim-sheet-range.ts     NEW  pure; parses/validates month & range params

src/app/api/zmanim/route.ts                 imports the extracted parser; 400 unchanged
src/app/(public)/zmanim/page.tsx            reads searchParams, selects view, metadata
src/app/(public)/zmanim/ZmanimSheet.tsx     NEW  server component, renders table
src/app/(public)/zmanim/SheetControls.tsx   NEW  client, month/range picker + toggle
src/app/(public)/zmanim/ZmanimPageContent.tsx  + view toggle; − duplicate label
```

### Unit boundaries

| Unit | Input → Output | Depends on | Testable via |
|---|---|---|---|
| `kiddush-levana.ts` | `(from, to)` → `MoladFootnotes[]`, lines already rendered | `@hebcal/core` Molad + HDate — **the only module that constructs either** | pure |
| `zmanim-location-params.ts` | `URLSearchParams` → `ZmanimLocation` or error | `zmanim-location.ts` | pure |
| `zmanim-sheet-range.ts` | `URLSearchParams` → `{ from, to }` | nothing | pure |
| `zmanim-sheet.ts` | `(ZmanimResponse[], labels[], dafYomi[], today)` → `SheetLine[]` | `kiddush-levana.ts` only — no direct hebcal use | pure |
| `ZmanimSheet.tsx` | `SheetLine[]` → HTML | `zmanim-sheet.ts` | rendering only |

Every unit's interface is stated above, so none requires reading its internals to use.
`ZmanimSheet.tsx` contains no date arithmetic and no halachic decisions.

### Page metadata

`page.tsx` currently exports static `metadata` with the title hardcoded to
`"Zmanim - Toronto"`. For a view whose entire purpose is being shared, it becomes
`generateMetadata` reflecting the month and location — otherwise every shared sheet
previews as "Toronto" regardless of what it shows.

All row-building logic is pure and separately testable. The component contains no
date arithmetic and no halachic decisions.

### Rendering strategy

`ZmanimSheet` is a **server component**. At ~34 ms/month there is no reason to fetch
client-side, and server rendering is what makes the page printable and shareable without
a loading flash. Only `SheetControls` is a client component.

`page.tsx` becomes an `async` server component reading `searchParams` and choosing
between the existing client `ZmanimPageContent` and the new server `ZmanimSheet`.

---

## 8. URL is the state

```
/zmanim?view=sheet&month=2026-08&lat=43.65&lon=-79.38&tzid=America/Toronto&label=Toronto,%20Ontario,%20Canada
/zmanim?view=sheet&from=2026-09-25&to=2026-10-10&...
```

- `view` absent, `week`, or **any unrecognised value** → week cards. `view=sheet` → the table.
- `month=YYYY-MM` and `from`/`to` are mutually exclusive; if both appear, `month` wins.
- Location params use the same names as `/api/zmanim`, but **not** the same function.

### The location parser must be extracted and wrapped, not reused

`parseLocation` is a module-private function inside `src/app/api/zmanim/route.ts:16` and
is **not exported**. More importantly its contract is the *opposite* of what a page needs:
it returns `{ error }` for bad input, which the route turns into a **400** (line 79). This
spec requires bad input to fall back to Toronto and always render.

So the work is:

1. Move the coordinate/tzid parsing into `src/lib/zmanim-location-params.ts` as
   `parseLocationParams(searchParams)`, returning `{ location } | { error }` exactly as
   today. `/api/zmanim` imports it and keeps returning 400 — **no behaviour change to the
   API**.
2. Add `parseLocationParamsOrToronto(searchParams)` in the same module for the page: same
   parse, but any error falls back to `TORONTO_LOCATION`.

Two named functions with two honest contracts, one parsing implementation. "Validation
stays in one place" must not mean one name with two behaviours.

### `tzid` needs a real validity check

Today `parseLocation` checks only that `tzid` is non-empty (`route.ts:54`). A URL carrying
`tzid=Nowhere/Fake` passes, then throws `RangeError` inside `toLocaleTimeString` in
`formatZman`. On the API that is a 500; on a **server-rendered page it is a blank error
page**, directly violating the guarantee below.

`parseLocationParams` therefore gains a real check — construct an `Intl.DateTimeFormat`
with the tzid inside a `try`/`catch` and reject on throw. This tightens `/api/zmanim` too:
a request that currently 500s will now correctly 400. That is a fix, not a regression, and
is called out here so it is not mistaken for scope creep.

### Why the URL and not localStorage

Location currently lives in localStorage via `useStoredZmanimLocation`, synced across
components by a `ft:zmanim-location-changed` event. That is right for a *preference* and
wrong for the *identity of the content*. The moment a view is shareable or printable, its
state must move into the URL, because the URL is the only part of the page that travels.
A localStorage-backed sheet would show the recipient's stored city, not the sender's.

The week view keeps localStorage and is unaffected.

### Crossing between views

Clicking `Calendar sheet` carries the currently stored location into the URL, so the view
does not silently snap back to Toronto. The picker on the sheet writes to **both** the URL
(via router navigation) and localStorage, so returning to the week view keeps the choice.

### Validation and error handling

| Input | Behaviour |
|---|---|
| `month` not `YYYY-MM`, or month outside 1–12 | fall back to the current month |
| `from`/`to` unparseable | fall back to the current month |
| `to` before `from` | swap them |
| span > 31 days | clamp `to` to `from + 30 days` and show an inline notice |
| invalid `lat`/`lon` | fall back to Toronto |
| `tzid` empty, or not a real IANA zone | fall back to Toronto |
| unrecognised `view` value | render the week view |
| year outside 1900–2200 | fall back to the current month |

Every case degrades to a rendered sheet. No input produces a 400, an exception or an
empty page — this is a public, linkable page and a stale bookmark must still render
something useful.

---

## 9. Deliberate deviations from the old sheet

### 9.1 Misheyakir 10.2°, not 11°

The old sheet printed `Mishe-yakir 11 deg`. We print **10.2°**.

A previous session set 10.2° deliberately to match MyZmanim, and the whole zmanim system
was verified time-by-time against MyZmanim for Toronto, New York and Jerusalem. Printing
11° on the sheet would either break that verification or make the site show two different
Misheyakir times on two pages for the same day.

Owner's decision: consistency wins. The column is labelled honestly as `Misheyakir 10.2°`,
not `11 deg`. The `Misheyakir 45 min` column is still added, because a fixed-minutes zman
and a degree-based zman diverge seasonally and anyone holding by clock-minutes needs it
regardless of the degree figure.

**Do not "restore" this to 11°.**

### 9.2 Sof Zman Tefilah (MA) added

The old sheet has Sof Zman Shema (MA) but no Sof Zman Tefilah (MA). We already compute
`sofZmanTfillaMGA16Point1()` and the existing week view already displays it. A table
showing MA shema without MA tefilah is lopsided for anyone using that shita, so this
reads as an old-site oversight rather than a decision.

Flagged for the owner; drop the column if strict parity is preferred.

### 9.3 One-minute differences are expected

`src/lib/zmanim-format.ts` rounds each row in its stringent direction — deadlines down,
permitted-from times up. The old ASP site almost certainly truncated everything. Some
cells will therefore differ from the old sheet by one minute. This is correct behaviour
and must not be treated as a bug when the two are compared side by side.

---

## 10. Print

`@media print` rules **gated on a wrapper class**, e.g. `.zmanim-sheet-print`, never on
bare element selectors.

This matters: a CSS import in `ZmanimSheet.tsx` applies to the whole `/zmanim` route, so a
global `header { display: none }` inside `@media print` would also strip the header when
someone prints the **week** view. There are currently zero `@media print` rules anywhere in
`globals.css`, so these are the first, and they must not leak.

Rules:

- Hide the site header and footer, the location picker, the view toggle and the range
  control.
- Table to full width; remove page padding and shadows.
- `page-break-inside: avoid` on rows; repeat `<thead>` across pages via
  `display: table-header-group`.
- Landscape hint via `@page { size: landscape; }`.
- Month/range and location printed in the heading so a pinned-up sheet identifies itself.

The site header and footer are rendered by `LayoutWrapper` (`LayoutWrapper.tsx:34,37`),
outside this component — hence the wrapper-class gate above rather than component scoping.

### On-screen accessibility

A twenty-one-column table needs the same structure that makes the print version work:

- `<caption>` naming the month/range and location.
- `scope="col"` on every header cell, `scope="row"` on the civil-day cell.
- `position: sticky` on `<thead>` for on-screen scanning — the same information need the
  print rules solve with `display: table-header-group`.
- The horizontal scroll container marked `tabindex="0"` with an accessible name, so it is
  reachable by keyboard rather than mouse-only.
- **A sticky LEFT identity block** (day letter, civil day, Hebrew date), not only a sticky
  header. On a twenty-one-column table the scanning failure is horizontal: scroll right to
  Tzeis and you can no longer tell which row you are on. This matters more than the sticky
  `<thead>`.

### Containing the horizontal scroll

This feature introduces the widest element on the site into a `container mx-auto px-4`
page, and the project has a documented recurring "grey space on the right of mobile" bug.
CLAUDE.md prescribes a prophylactic:

```css
html, body { overflow-x: hidden; max-width: 100vw; }
```

**That rule is not present** — verified, there is no `overflow-x` anywhere in
`globals.css`, `layout.tsx`, or `src/components/layout/`. So the documented guard is
absent precisely as the widest element on the site arrives.

`overflow-x: auto` on the wrapper is **not** what prevents blow-out; `min-w-0` /
`max-w-full` on it is, because a grid or flex child defaults to `min-width: auto` and
refuses to shrink below its content. Both go on the scroll container, and §11.4 verifies
that the page **body** does not scroll horizontally at 375px — only the table does.

---

## 11. Testing

### 11.0 Two different jobs, two different tolerances

Conflating these produced a gate that could not catch what it guarded.

| | Purpose | Source of truth | Tolerance |
|---|---|---|---|
| **Regression** | our output did not change | a **self-snapshot** of the current tree | **zero** |
| **Parity** | we agree with the old sheet | the transcribed screenshots | ±1 min (§9.3) |

The regression gate is what the hebcal upgrade runs against. It is free, needs no
transcription, and is exact. The parity fixture answers a different question — *are we
faithful to what the community read for years* — and must be loose enough to tolerate our
own stringent rounding, which makes it useless as a regression gate.

### 11.1 Old-sheet parity fixture

The ticket screenshots are a **complete published fixture**: Toronto, August 2026, all 31
days, every column, produced by the system we are reproducing. These values are
transcribed into a fixture file and compared against our output for the full month.

Allowed deltas, asserted explicitly rather than loosened globally:

- **±1 minute on any cell**, from stringent rounding (§9.3).
- **The Misheyakir degree column is excluded from the fixture comparison entirely.** The
  fixture contains only 11° values and we deliberately print 10.2° (§9.1), so comparing
  that column against the old sheet would either always fail or require an allowance so
  wide it tests nothing. Comparing it to our own output would be circular — the test and
  the code would share any bug and agree. It is instead covered by a separate, small
  assertion against **independently sourced MyZmanim values** for a handful of dates,
  which is the source 10.2° was chosen to match in the first place.

Any other difference fails. This is a far stronger test than hand-written expectations,
because it validates against an independent implementation.

**Transcription policy:** cells are read off screenshots by hand, so some mismatches will
be transcription errors rather than code defects. On any single-cell mismatch, re-read the
screenshot first and correct the fixture if it was mistyped. A mismatch across a whole
column or a whole row is a code defect. Note that the most likely *systematic*
transcription failure — misreading column order — presents as a whole-column mismatch and
so would be misfiled as a code defect by that rule; check alignment first when a full
column disagrees.

**August 2026 is close to the least informative month available.** Measured: **zero** chag
events and **zero** fast events, no DST transition, one Hebrew-month crossing. It validates
the ordinary weekday case and nothing else. The rows most likely to carry a damaging
printed error are all absent:

- Two-day Yom Tov, where the second night's candle lighting is *after* tzeis rather than
  before shkia. (Verified that hebcal emits this correctly — Sep 12 2026 = 8:16 PM,
  post-shkia — but the sheet's rendering of it is untested by an August fixture.)
- Fast days, per §5.2.1.
- A DST boundary.

So parity is sampled at **two** months: August 2026 (the full transcription, an easy month
read end to end) plus a **partial September/October 2026** covering Rosh Hashana, Tzom
Gedaliah, Yom Kippur and Sukkos. If transcription effort has to be cut, cut August — the
hard month is the one worth having.

### 11.2 Unit tests

| Module | Cases |
|---|---|
| `kiddush-levana.ts` | Elul 5786 → Fri 2026-08-28 02:37 (verified above); both rendered lines match the old sheet's strings verbatim; a range containing zero footnotes, one, and two; a month where the result crosses a Gregorian month boundary; a leap-year (Adar I/II) month |
| Molad derivation | Elul 5786 → Thu 2026-08-13; **a zero-distance month, where molad dow equals Rosh Chodesh dow (§6.3) — must not go back seven days**; a molad falling in the previous Gregorian month |
| `zmanim-location-params.ts` | valid set → location; missing/blank/out-of-range lat/lon → error; **`tzid="Nowhere/Fake"` → error, not a `RangeError` downstream**; `…OrToronto` returns Toronto for every error case |
| `zmanim-sheet-range.ts` | every row of the §8 validation table, including unrecognised `view` |
| `zmanim-sheet.ts` | footnote placed on the right row; footnote outside range omitted; both footnotes in one range; a day carrying **two** labels (Rosh Chodesh + Chanukah) keeps both; Rosh Chodesh alone is labelled |
| `zmanim-format.ts` | existing key-coverage test now covers the two new zmanim |
| `zmanim.ts` | `getZmanimForRange` across a DST transition — every day stays at 12:00 UTC; `labelsForDate` returns Rosh Chodesh, which `specialDay` does not |

### 11.3 Server-timezone tests

`vitest.config.mts` already pins the unit project to `TZ=UTC`, and
`tests/unit/zmanim-calc.test.ts` relocates the "server" across UTC/Tokyo/Kolkata/
Toronto/LA. `getZmanimForRange` and the footnote-placement logic are added to that
relocation test. Two production bugs in this area survived precisely because they do not
reproduce on an America/Toronto dev machine.

### 11.4 Rabbinic sign-off — required before the print button ships

This document makes at least four halachic editorial decisions, all currently made by a
developer:

1. Misheyakir printed at 10.2° where the community read 11° for years (§9.1).
2. Adding Sof Zman Tefilah (MA), which the old sheet omitted (§9.2) — justified in this
   spec as "reads as an oversight", which is a guess about someone else's luach.
3. Collapsing Havdalah into the Tzeis 8.5° column (§5.2).
4. Stringent-direction rounding throughout — including havdalah, where CLAUDE.md itself
   records the open concern that we land ~1 minute **lenient** of Chabad for a time that
   *ends* Shabbos. This spec does not resolve that, and printing amplifies it.

On screen a wrong time is corrigible on the next page load. On a wall it is wrong for a
month. **A rav who used the old sheet reviews the column set, the headings and the shitos
before printing is enabled.** Not a formality — items 1 and 4 are exactly the kind of thing
that generates a complaint, and item 4 is a known open question rather than a settled one.

### 11.5 Manual verification

Print preview in a real browser at both A4 and Letter, landscape and portrait; a shared
URL opened in a second browser profile to confirm the location travels; horizontal scroll
on a 375px viewport.

---

## 12. Bundled fix

Remove the redundant location `<p>` at `ZmanimPageContent.tsx:187-190`. The label then
appears twice — once in the `<h1>` and once inside the picker, which is the picker's own
current-value display and is correct. This is the repetition reported alongside the
ticket.

---

## 13. Sequencing

The August 2026 fixture is built **before** the hebcal upgrade, so it can act as the
regression gate on that upgrade. This reorders the obvious sequence deliberately.

1. Transcribe the August 2026 fixture (§11.1) — **all** columns, including ones we cannot
   yet compute — and wire up the comparison test against the **current** tree. The harness
   loops `getZmanimForDate` directly, since `getZmanimForRange` does not exist until
   step 4. Four columns are unasserted at this point:

   - `Daf Yomi` — pending step 2
   - `Alos 72 min`, `Misheyakir 45 min` — pending step 4
   - `Misheyakir` degree — permanently excluded (§11.1)

   Confirm green. Listing the exclusions here is what keeps the first run unambiguous.
2. Spike `@hebcal/learning` on a throwaway branch: install it, re-run the fixture test and
   the full existing zmanim suite. **Decision point (§6.2)** — clean upgrade, standalone
   Daf Yomi, or drop the column. Nothing else proceeds until this is answered.
3. `kiddush-levana.ts` + Molad civil-date derivation, with tests.
4. Two new zmanim + `ZMAN_DIRECTION` entries + `labelsForDate` + `getZmanimForRange`,
   with tests. Extend the fixture test to the two new columns.
5. Extract `zmanim-location-params.ts`; point `/api/zmanim` at it; confirm the API's
   existing tests still pass.
6. `zmanim-sheet-range.ts` and `zmanim-sheet.ts`, with tests.
7. `ZmanimSheet.tsx` + `SheetControls.tsx` + `page.tsx` routing + `generateMetadata`.
8. Print stylesheet and on-screen table accessibility.
9. Bundled duplicate-label fix.
10. Manual verification (§11.4).

Steps 1 and 3–6 produce no user-visible change and are verified entirely by tests before
any UI exists.

---

## 14. Open items for the owner

Raised by adversarial review (three lenses) after the design was approved. Each reopens a
decision or adds one; none is resolved unilaterally.

1. **§9.1 — Misheyakir: add 11° as a THIRD column?** The earlier choice was framed as
   10.2° *or* 11°, and 10.2° was chosen for site consistency. That was a false dilemma: the
   sheet already carries two Misheyakir columns, so adding `timeAtAngle(11, true)` is one
   line. It restores old-sheet parity, leaves the week view untouched, and closes the hole
   in §11.1 where the degree column has to be excluded from parity comparison for having
   nothing comparable to compare against. *Recommended.*

2. **§6.8 — separate `/zmanim/month` route instead of a view toggle?** The toggle was
   chosen before it was known that `force-dynamic` applies to the whole route segment and
   would make the currently-static week view dynamic. A separate route also answers the
   ticket better: *"do you still have"* is a discoverability complaint, and `?view=sheet`
   is not linkable, nameable, or indexable. *Recommended.*

3. **§4 — keep the custom range, or month-only?** The range selector has no requester (the
   ticket said *month*), and costs `zmanim-sheet-range.ts`, seven rows of validation, and
   its own tests. It also cannot express the one multi-month span a shul actually prints —
   the Tishrei season — because that exceeds 31 days. *Weak recommendation: month-only,
   add ranges if asked.*

4. **§11.4 — rav sign-off before print ships.** *Recommended.*

5. **§9.2** — keep Sof Zman Tefilah (MA), or strict parity and drop it?

6. **Phasing.** Ship the sheet using only the 14 already-verified zmanim first (answering
   the ticket), then add footnotes, the two new zmanim and Daf Yomi? Or build it whole?
   §13 currently sequences six of ten steps before anything is user-visible.

**No longer an open item:** the `@hebcal/noaa` upgrade was measured clean across every API
this codebase uses (§6.2). Take it.

### Also worth fixing, independent of this feature

`ZmanimPageContent.tsx:266,280` renders buttons titled **"Previous month" / "Next month"**
that jump the anchor by a month and then render **seven day cards**. Someone clicking those
expecting a month gets a week — which is a plausible origin for the ticket that started
this work.
