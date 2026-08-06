# Zmanim Month Sheet Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/zmanim/month` — a printable, month-at-a-glance zmanim table reproducing the one the old FrumToronto site published, without changing the existing week view.

**Architecture:** A new route segment `src/app/(public)/zmanim/month/`, server-rendered (~34 ms/month measured, so no client fetch). All date arithmetic and halachic decisions live in pure modules under `src/lib/` that are unit-testable without a DOM or a database; the React component only maps a prepared `SheetLine[]` to `<tr>`s. Location travels in the URL, not localStorage, because the page is meant to be shared and printed.

**Tech Stack:** Next.js 16 App Router, TypeScript, `@hebcal/core` (upgraded 6.0.6 → 6.9.1), `@hebcal/learning` (new), Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-05-zmanim-month-sheet-design.md` — read §14 first; it records six owner decisions that are **closed**. Do not reopen them.

---

## Before you start — five things that will bite you

1. **`npx vitest run --project unit <path>`** runs a single unit test file. The unit project is pinned to `TZ=UTC` deliberately (that is what Vercel runs); do not "fix" a test by changing the timezone.
2. **`@hebcal/core` is ESM-only, and `npx tsx` CANNOT run anything that imports it.** You get
   `ERR_PACKAGE_PATH_NOT_EXPORTED: No "exports" main defined`. Renaming to `.mts` does not
   help, and this is still true after the 6.9.1 upgrade (its `exports` map has an `import`
   condition only). For any repo script that touches zmanim code use:

   ```bash
   TZ=UTC npx vite-node -c vitest.config.mts <script.ts>
   ```

   The `-c` is required — it supplies the `@` path alias. `TZ=UTC` is required so a
   generator produces the same values as the test that consumes it.

   For quick throwaway probes, a `.mjs` file at the repo root importing
   `./node_modules/@hebcal/core/dist/esm/index.js` works with plain `node`.
   In app and test code, the normal `import { ... } from "@hebcal/core"` is fine.
3. **Measure at `TORONTO_LOCATION`** (`43.6629, -79.3957` — `src/lib/zmanim-location.ts`),
   never at a rounded-off `43.65, -79.38`. A ~0.02° difference moves a zman by ~2 seconds,
   which is enough to flip a displayed minute. An earlier draft of this plan asserted the
   wrong time for 4 August for exactly this reason.
4. **`roundZman` is a no-op on any value already at `:00` seconds** (`src/lib/zmanim-format.ts:58`). A pre-rounded zman therefore silently loses its rounding policy. This caused two real bugs. Never hand it a pre-rounded value.
5. **Never use `new Date()` for "today"** in this feature. Use `todayInLocation(location)` from `src/lib/zmanim-day.ts`. Server-local time is UTC on Vercel; the project has shipped two production bugs from this.
6. **Commit messages must not mention Claude or AI.** Match the existing log style.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/zmanim.ts` *(modify)* | + `alotHaShachar72`, `misheyakir45` on `ZmanimTimes`; + `labelsForDate()`; + `getZmanimForRange()` |
| `src/lib/zmanim-format.ts` *(modify)* | + 2 entries in `ZMAN_DIRECTION` |
| `src/lib/kiddush-levana.ts` *(new)* | The **only** module that constructs `Molad` or `HDate` for footnotes. Returns both rendered footnote lines for a date range. |
| `src/lib/zmanim-month-param.ts` *(new)* | `"YYYY-MM"` → `{ from, to }`; anything invalid → current month in the location |
| `src/lib/zmanim-location-params.ts` *(new)* | Extracted from the API route; two contracts (400 vs Toronto-fallback), one parser |
| `src/lib/daf-yomi.ts` *(new)* | Thin wrapper over `DailyLearning`, so the rest of the code never touches the registry |
| `src/lib/zmanim-sheet.ts` *(new)* | `SheetLine[]` — day rows with footnotes and fast-day rows interleaved. Pure. |
| `src/app/api/zmanim/route.ts` *(modify)* | Imports the extracted parser; behaviour unchanged except a bogus `tzid` now 400s instead of 500ing |
| `src/app/(public)/zmanim/month/page.tsx` *(new)* | Server component + `generateMetadata` |
| `src/app/(public)/zmanim/month/ZmanimSheet.tsx` *(new)* | Renders `SheetLine[]` to a table. No date logic. |
| `src/app/(public)/zmanim/month/MonthPicker.tsx` *(new)* | Client: month/year select, arrows, location picker |
| `src/app/(public)/zmanim/month/print.css` *(new)* | `@media print`, gated on `.zmanim-sheet-print` |
| `src/app/(public)/zmanim/ZmanimPageContent.tsx` *(modify)* | + link to the sheet; − duplicate location label |
| `src/components/layout/Footer.tsx` *(modify)* | + link to the sheet |

---

## Chunk 1: Gate the upgrade, then take it

### Task 1: Zero-tolerance snapshot gate

The upgrade in Task 2 has been measured clean, but "measured once by hand" is not a gate. This makes it repeatable. **Zero tolerance** — this is a regression test, not the parity fixture (spec §11.0).

**Files:**
- Create: `tests/unit/zmanim-snapshot.test.ts`
- Create: `tests/fixtures/zmanim-snapshot.json` (generated)
- Create: `scripts/generate-zmanim-snapshot.ts`

- [ ] **Step 1: Write the generator**

```ts
// scripts/generate-zmanim-snapshot.ts
// Captures the CURRENT tree's zmanim output so an upgrade can be diffed against
// it at zero tolerance. Regenerate ONLY when a change to output is intended.
import { writeFileSync, mkdirSync } from "node:fs";
import { getZmanimForDate } from "../src/lib/zmanim";
import { TORONTO_LOCATION, type ZmanimLocation } from "../src/lib/zmanim-location";
import { anchorCalendarDate, addAnchoredDays } from "../src/lib/zmanim-day";

const JERUSALEM: ZmanimLocation = {
  lat: 31.7683, lon: 35.2137, tzid: "Asia/Jerusalem",
  label: "Jerusalem, Israel", isIsrael: true,
};

const snapshot: Record<string, Record<string, string | null>> = {};

for (const loc of [TORONTO_LOCATION, JERUSALEM]) {
  const start = anchorCalendarDate(new Date(Date.UTC(2026, 0, 1, 12)));
  for (let i = 0; i < 366; i++) {
    const d = addAnchoredDays(start, i);
    const r = getZmanimForDate(d, loc);
    const key = `${loc.label}|${d.toISOString().slice(0, 10)}`;
    const row: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(r.zmanim)) {
      row[k] = (v as Date).toISOString();
    }
    row.candleLighting = r.candleLighting?.toISOString() ?? null;
    row.havdalah = r.havdalah?.toISOString() ?? null;
    // hebrewDate and parsha are deliberately NOT captured: the test does not
    // assert them, and a snapshot field nobody checks invites the assumption
    // that it is covered.
    snapshot[key] = row;
  }
}

mkdirSync("tests/fixtures", { recursive: true });
writeFileSync("tests/fixtures/zmanim-snapshot.json", JSON.stringify(snapshot, null, 1));
console.log(`wrote ${Object.keys(snapshot).length} days`);
```

- [ ] **Step 2: Generate the snapshot**

Run: `TZ=UTC npx vite-node -c vitest.config.mts scripts/generate-zmanim-snapshot.ts`
Expected: `wrote 732 days`

- [ ] **Step 3: Write the test that reads it**

```ts
// tests/unit/zmanim-snapshot.test.ts
import { describe, it, expect } from "vitest";
import snapshot from "../fixtures/zmanim-snapshot.json";
import { getZmanimForDate } from "@/lib/zmanim";
import { TORONTO_LOCATION, type ZmanimLocation } from "@/lib/zmanim-location";
import { anchorCalendarDate, addAnchoredDays } from "@/lib/zmanim-day";

const JERUSALEM: ZmanimLocation = {
  lat: 31.7683, lon: 35.2137, tzid: "Asia/Jerusalem",
  label: "Jerusalem, Israel", isIsrael: true,
};

// ZERO tolerance. This is the gate on the @hebcal upgrade, and the change it
// must detect is exactly one minute — the same size as the rounding tolerance
// the PARITY fixture (§11.1) allows. Loosening this makes it useless.
describe("zmanim output has not changed", () => {
  it("matches the committed snapshot exactly", () => {
    const drift: string[] = [];

    for (const loc of [TORONTO_LOCATION, JERUSALEM]) {
      const start = anchorCalendarDate(new Date(Date.UTC(2026, 0, 1, 12)));
      for (let i = 0; i < 366; i++) {
        const d = addAnchoredDays(start, i);
        const key = `${loc.label}|${d.toISOString().slice(0, 10)}`;
        const expected = (snapshot as Record<string, Record<string, string | null>>)[key];
        expect(expected, `missing snapshot key ${key}`).toBeDefined();

        const r = getZmanimForDate(d, loc);
        // Catch REMOVED keys too: iterating only the runtime object would let a
        // deleted zman pass silently.
        const expectedKeys = Object.keys(expected).filter(
          (k) => !["candleLighting", "havdalah", "hebrewDate", "parsha"].includes(k)
        );
        expect(Object.keys(r.zmanim).sort()).toEqual(expectedKeys.sort());

        for (const [k, v] of Object.entries(r.zmanim)) {
          const got = (v as Date).toISOString();
          if (got !== expected[k]) drift.push(`${key} ${k}: ${expected[k]} -> ${got}`);
        }
        const cl = r.candleLighting?.toISOString() ?? null;
        if (cl !== expected.candleLighting) drift.push(`${key} candleLighting: ${expected.candleLighting} -> ${cl}`);
        const hv = r.havdalah?.toISOString() ?? null;
        if (hv !== expected.havdalah) drift.push(`${key} havdalah: ${expected.havdalah} -> ${hv}`);
      }
    }

    expect(drift.slice(0, 20)).toEqual([]);
  });
});
```

- [ ] **Step 4: Run it — it must PASS (this one is a baseline, not a red test)**

Run: `npx vitest run --project unit tests/unit/zmanim-snapshot.test.ts`
Expected: PASS, 1 test.

If it fails now, the generator and the test disagree — fix that before continuing, or the gate is meaningless.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-zmanim-snapshot.ts tests/unit/zmanim-snapshot.test.ts tests/fixtures/zmanim-snapshot.json
git commit -m "test(zmanim): zero-tolerance output snapshot as the upgrade gate"
```

---

### Task 2: Take the @hebcal upgrade

Measured clean already (spec §6.2): 10,980 zmanim values and 5,848 calendar values, zero displayed-minute changes. This is confirmation.

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install**

Run: `npm install @hebcal/learning@6.9.7`

This also moves `@hebcal/core` 6.0.6 → 6.9.1, `@hebcal/hdate` → 0.22.7, `@hebcal/noaa` → 0.12.2.

- [ ] **Step 2: Run the gate**

Run: `npx vitest run --project unit`
Expected: **all pass**, including `zmanim-snapshot`.

**If the snapshot fails:** STOP. Do not regenerate it. A failure means the upgrade moved a halachic time and the decision in §14 was made on wrong information. Report the drift to the owner.

- [ ] **Step 3: Confirm Daf Yomi works through the registry**

Create `_tmp_daf.mjs` at repo root:

```js
import { HDate } from "./node_modules/@hebcal/core/dist/esm/index.js";
import { DailyLearning } from "./node_modules/@hebcal/core/dist/esm/index.js";
import "./node_modules/@hebcal/learning/dist/esm/index.js";
const hd = new HDate(new Date(Date.UTC(2026, 7, 1, 12)));
console.log("registered:", DailyLearning.getCalendars());
// getDesc(), NOT render() — render() prefixes "Daf Yomi: ".
console.log("2026-08-01:", DailyLearning.lookup("dafYomi", hd, false)?.getDesc());
```

Run: `node _tmp_daf.mjs && rm _tmp_daf.mjs`
Expected: the calendar list includes `dafYomi`, and the lookup prints **`Chullin 93`**
(hebcal spells it with two L's; the old sheet printed "Chulin" — see Task 3).

If the import path or export name differs, adjust — the package's entry point is the only unknown here. If `lookup` returns `null`, the registry did not receive the calendar; check that the `@hebcal/learning` side-effect import ran.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add @hebcal/learning for daf yomi, taking core 6.9.1

Measured clean before committing: 10,980 zmanim values across 366 days and
two cities, plus 5,848 calendar values across 731 days, are byte-identical
between 6.0.6 and 6.9.1. tests/unit/zmanim-snapshot.test.ts holds the line."
```

---

### Task 3: `daf-yomi.ts` — one place that touches the registry

**Files:**
- Create: `src/lib/daf-yomi.ts`
- Test: `tests/unit/daf-yomi.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/daf-yomi.test.ts
import { describe, it, expect } from "vitest";
import { dafYomiForDate } from "@/lib/daf-yomi";

const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

describe("dafYomiForDate", () => {
  // Golden values transcribed from the old FrumToronto sheet, August 2026.
  it.each([
    // Daf numbers transcribed from the old sheet, August 2026. The SPELLING is
    // hebcal's: it renders "Chullin", the old sheet printed "Chulin". The daf
    // numbers are what prove the right calendar and il flag; the spelling is a
    // display question, deliberately not hand-mapped (a tractate-name lookup
    // table is a maintenance liability for one doubled letter).
    [day(2026, 8, 1), "Chullin 93"],
    [day(2026, 8, 2), "Chullin 94"],
    [day(2026, 8, 13), "Chullin 105"],
    [day(2026, 8, 31), "Chullin 123"],
  ])("%s -> %s", (date, expected) => {
    expect(dafYomiForDate(date)).toBe(expected);
  });

  it("returns a string for any date in the sheet's supported range", () => {
    expect(dafYomiForDate(day(2027, 3, 15))).toBeTypeOf("string");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project unit tests/unit/daf-yomi.test.ts`
Expected: FAIL — cannot resolve `@/lib/daf-yomi`.

- [ ] **Step 3: Implement**

```ts
// src/lib/daf-yomi.ts
//
// The ONLY module that touches DailyLearning. That registry is module-level
// static state populated by a side-effect import, which is easy to get wrong in
// a way that fails silently (lookup returns null, nothing throws) — so it is
// isolated here behind a plain function.
import { HDate, DailyLearning } from "@hebcal/core";
import "@hebcal/learning";

/**
 * Daf Yomi for a civil date, e.g. "Chullin 93" (hebcal's spelling).
 *
 * `date` must already be anchored (noon UTC) — see src/lib/zmanim-day.ts.
 * Returns null before the Daf Yomi cycle began (1923), which the sheet renders
 * as an empty cell rather than a placeholder.
 */
export function dafYomiForDate(date: Date): string | null {
  const ev = DailyLearning.lookup("dafYomi", new HDate(date), false);
  // getDesc(), not render(): render("en") returns "Daf Yomi: Chullin 93" — the
  // prefix belongs in the column heading, not in every cell.
  return ev ? ev.getDesc() : null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run --project unit tests/unit/daf-yomi.test.ts`
Expected: PASS, 5 tests.

If a **daf number** is wrong, do not change it — the numbers come from the published old
sheet and a mismatch means the wrong calendar or `il` flag. The **spelling** is hebcal's
and is expected to differ from the old sheet ("Chullin" vs "Chulin").

- [ ] **Step 5: Commit**

```bash
git add src/lib/daf-yomi.ts tests/unit/daf-yomi.test.ts
git commit -m "feat(zmanim): daf yomi lookup, verified against the old sheet's August 2026 values"
```

---

### Task 4: `kiddush-levana.ts` — both footnote lines

Spec §6.3–§6.5. This module owns **every** `Molad` and `HDate` construction for footnotes.

**Files:**
- Create: `src/lib/kiddush-levana.ts`
- Test: `tests/unit/kiddush-levana.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/kiddush-levana.test.ts
import { describe, it, expect } from "vitest";
import { moladFootnotesInRange } from "@/lib/kiddush-levana";

const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("moladFootnotesInRange", () => {
  // Both strings below are transcribed from the old sheet, August 2026.
  const august = moladFootnotesInRange(day(2026, 8, 1), day(2026, 8, 31));

  it("finds the Elul molad in August 2026", () => {
    const elul = august.find((f) => f.monthName === "Elul");
    expect(elul).toBeDefined();
    expect(iso(elul!.moladCivilDate)).toBe("2026-08-13");
    expect(elul!.moladLine).toBe(
      "The Molad for Elul will take place: Thursday 8:15 AM + 0 Chalakim - August 13"
    );
  });

  it("derives sof zman kiddush levanah as molad + 14d 18h 22m 1 chelek", () => {
    const elul = august.find((f) => f.monthName === "Elul")!;
    expect(iso(elul.sofZmanCivilDate)).toBe("2026-08-28");
    expect(elul.sofZmanLine).toBe("Sof Zman Kiddush Levanoh: Friday 2:37 AM + 0 Chalakim");
  });

  it("omits footnotes whose dates fall outside the range", () => {
    // 1-10 August contains neither the 13th nor the 28th.
    expect(moladFootnotesInRange(day(2026, 8, 1), day(2026, 8, 10))).toEqual([]);
  });

  // THE ZERO-DISTANCE CASE — molad weekday == Rosh Chodesh weekday, so the walk
  // back is 0 days. Reading the rule as "the PRECEDING occurrence" lands a full
  // week early. About 1 month in 28 hits this.
  //
  // These two months are real instances, and the expected dates below are what
  // discriminates: the buggy `((...) % 7) || 7` variant yields 2032-12-25 and
  // 2033-09-17 respectively. A test that only checks the molad->sofZman GAP
  // cannot detect the bug at all, because both dates shift together.
  it.each([
    [day(2033, 1, 1), "2033-01-01"],   // Sh'vat 5793 — buggy variant: 2032-12-25
    [day(2033, 9, 24), "2033-09-24"],  // Tishrei 5794 — buggy variant: 2033-09-17
  ])("walks back 0 days when the molad falls on Rosh Chodesh itself (%s)", (probe, expected) => {
    const found = moladFootnotesInRange(
      new Date(probe.getTime() - 3 * 86_400_000),
      new Date(probe.getTime() + 3 * 86_400_000)
    ).find((f) => iso(f.moladCivilDate) === expected);
    expect(found, `no molad on ${expected}`).toBeDefined();
  });

  // Spec section 11.2 also requires these.
  // NOTE: Aug-Sep 2026 contains NO crossing — Elul 08-13 -> 08-28 and Tishrei
  // 09-11 -> 09-26 both stay inside their month. For part of each year the
  // molad sits early enough in the Gregorian month that a ~15-day offset cannot
  // cross. Use a window where one genuinely occurs, and pin both dates rather
  // than merely asserting one was found.
  it("handles a molad whose sof zman crosses a Gregorian month boundary", () => {
    const f = moladFootnotesInRange(day(2027, 9, 1), day(2027, 10, 31));
    const crossing = f.find(
      (x) => x.moladCivilDate.getUTCMonth() !== x.sofZmanCivilDate.getUTCMonth()
    );
    expect(crossing).toBeDefined();
    expect(iso(crossing!.moladCivilDate)).toBe("2027-09-30");
    expect(iso(crossing!.sofZmanCivilDate)).toBe("2027-10-15");
  });

  it("handles a leap year with Adar I and Adar II", () => {
    // 5784 is a leap year: 13 months.
    const names = moladFootnotesInRange(day(2024, 2, 1), day(2024, 4, 30)).map((f) => f.monthName);
    expect(names.some((n) => /Adar/.test(n))).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project unit tests/unit/kiddush-levana.test.ts`
Expected: FAIL — cannot resolve `@/lib/kiddush-levana`.

- [ ] **Step 3: Implement**

```ts
// src/lib/kiddush-levana.ts
//
// Both inline footnote lines the old sheet printed. This is the ONLY module
// that constructs `Molad` or `HDate` for them, so the constructor trap below
// has exactly one home.
import { HDate, Molad } from "@hebcal/core";
import { anchorCalendarDate } from "@/lib/zmanim-day";

/** One chelek = 1/1080 of an hour = 3⅓ seconds. */
const CHELEK_MS = 3_600_000 / 1080;

/**
 * Half a lunar month, as the old site reckoned it.
 *
 * Encoded LITERALLY as 14d 18h 22m + 1 chelek. Do NOT "simplify" this to half
 * of 29d 12h 44m 3⅓c — that is 14d 18h 22m 1.667s, which is 1.67s different and
 * no longer reproduces the published "Friday 2:37 AM".
 */
const SOF_ZMAN_OFFSET_MS = ((14 * 24 + 18) * 60 + 22) * 60_000 + CHELEK_MS;

export interface MoladFootnotes {
  monthName: string;
  moladCivilDate: Date;
  moladLine: string;
  sofZmanCivilDate: Date;
  sofZmanLine: string;
}

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function clockLabel(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC",
  });
}

/**
 * Civil date of the molad: from Rosh Chodesh, walk back 0-6 days to the molad's
 * weekday.
 *
 * ZERO IS A REAL CASE — about 1 month in 28. Reading this as "the PRECEDING
 * occurrence" goes back a full seven days and prints the footnote a week early.
 */
function moladCivilDate(roshChodesh: HDate, moladDow: number): Date {
  // anchorCalendarDate FIRST. HDate.greg() returns LOCAL midnight, so reading
  // getUTCDate() off it shifts a day on any positive-offset machine — measured:
  // in Asia/Tokyo and Pacific/Auckland the zero-distance months come out a FULL
  // WEEK early (Sh'vat 5793 -> 2032-12-25 instead of 2033-01-01). The unit
  // project is pinned TZ=UTC, so no test would ever catch this; it bites only a
  // developer's machine. This is exactly what src/lib/zmanim-day.ts exists for.
  const rc = anchorCalendarDate(roshChodesh.greg());
  const back = (rc.getUTCDay() - moladDow + 7) % 7;
  return new Date(Date.UTC(rc.getUTCFullYear(), rc.getUTCMonth(), rc.getUTCDate() - back, 12));
}

/** Every footnote whose date falls inside [from, to], in date order. */
export function moladFootnotesInRange(from: Date, to: Date): MoladFootnotes[] {
  const out: MoladFootnotes[] = [];

  // Widen by a lunar month at each end: a molad before `from` can still put its
  // sof zman inside the range, and vice versa.
  const scanFrom = new HDate(new Date(from.getTime() - 31 * 86_400_000));
  const scanTo = new HDate(new Date(to.getTime() + 31 * 86_400_000));

  for (let hy = scanFrom.getFullYear(); hy <= scanTo.getFullYear(); hy++) {
    const monthsInYear = HDate.monthsInYear(hy);
    for (let hm = 1; hm <= monthsInYear; hm++) {
      // (year, month) NUMBERS. Passing an HDate throws
      // "TypeError: HDate called with bad arg: NaN" on core 6.9.1 — it failed
      // SILENTLY with NaN getters on 6.0.6, so older notes describe it that way.
      const molad = new Molad(hy, hm);
      const rc = new HDate(1, hm, hy);
      const monthName = rc.getMonthName();

      const civil = moladCivilDate(rc, molad.getDow());
      const moladInstant = new Date(
        civil.getTime() - 12 * 3_600_000 + molad.getHour() * 3_600_000 + molad.getMinutes() * 60_000
      );
      const sofZman = new Date(moladInstant.getTime() + SOF_ZMAN_OFFSET_MS);

      const inRange = (d: Date) => d.getTime() >= from.getTime() && d.getTime() <= to.getTime();
      const sofZmanCivil = new Date(
        Date.UTC(sofZman.getUTCFullYear(), sofZman.getUTCMonth(), sofZman.getUTCDate(), 12)
      );
      if (!inRange(civil) && !inRange(sofZmanCivil)) continue;

      const monthLabel = civil.toLocaleDateString("en-US", {
        month: "long", day: "numeric", timeZone: "UTC",
      });

      out.push({
        monthName,
        moladCivilDate: civil,
        // The molad time is stated in the traditional fixed reckoning and is
        // deliberately NOT converted to the viewer's timezone. hebcal prints
        // 8:15am and so did the old ASP site, in Toronto. This is the only time
        // on the whole sheet that is intentionally not local.
        moladLine:
          `The Molad for ${monthName} will take place: ${DOW[molad.getDow()]} ` +
          `${clockLabel(moladInstant)} + ${molad.getChalakim()} Chalakim - ${monthLabel}`,
        sofZmanCivilDate: sofZmanCivil,
        sofZmanLine:
          `Sof Zman Kiddush Levanoh: ${DOW[sofZman.getUTCDay()]} ` +
          `${clockLabel(sofZman)} + ${molad.getChalakim()} Chalakim`,
      });
    }
  }

  return out.sort((a, b) => a.moladCivilDate.getTime() - b.moladCivilDate.getTime());
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run --project unit tests/unit/kiddush-levana.test.ts`
Expected: PASS, **7 tests** — the `it.each` block contributes 2, not 1.

The two golden strings are transcribed from the published sheet. If they mismatch, the bug is here — do not edit the expectations.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kiddush-levana.ts tests/unit/kiddush-levana.test.ts
git commit -m "feat(zmanim): molad and sof zman kiddush levanah footnote lines

Reproduces the old sheet's published values exactly: molad Elul 5786 on
Thursday Aug 13 at 8:15 AM, sof zman the following Friday at 2:37 AM.

The half-lunar-month constant is encoded literally as 14d 18h 22m plus one
chelek. Deriving it as half of 29d 12h 44m 3.333c gives a value 1.67s
different, which no longer reproduces the published time."
```

---

## Chunk 2: Zmanim, labels and parameters

### Task 5: Two new zmanim — and the rounding trap

Spec §6.1. **`misheyakir45` MUST use `sunriseOffset(-45, false)`.** The `true` variant truncates seconds, which defeats `roundZman` and prints a minute early on nearly every row.

**Files:**
- Modify: `src/lib/zmanim.ts`
- Modify: `src/lib/zmanim-format.ts:28-49`
- Test: `tests/unit/zmanim-new-zmanim.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/zmanim-new-zmanim.test.ts
import { describe, it, expect } from "vitest";
import { getZmanimForDate } from "@/lib/zmanim";
import { formatZmanByKey, ZMAN_DIRECTION } from "@/lib/zmanim-format";
import { TORONTO_LOCATION } from "@/lib/zmanim-location";

const TZ = TORONTO_LOCATION.tzid;
const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

describe("alos 72 minutes", () => {
  it("is exactly 72 clock minutes before sunrise, in both solstices", () => {
    for (const d of [day(2026, 6, 21), day(2026, 12, 21)]) {
      const { zmanim } = getZmanimForDate(d, TORONTO_LOCATION);
      const delta = zmanim.sunrise.getTime() - zmanim.alotHaShachar72.getTime();
      expect(delta).toBe(72 * 60_000);
    }
  });
});

describe("misheyakir 45 minutes", () => {
  it("is exactly 45 clock minutes before sunrise", () => {
    const { zmanim } = getZmanimForDate(day(2026, 8, 1), TORONTO_LOCATION);
    expect(zmanim.sunrise.getTime() - zmanim.misheyakir45.getTime()).toBe(45 * 60_000);
  });

  // The regression. sunriseOffset(-45, true) TRUNCATES seconds, so the value
  // reaches roundZman already at :00, roundZman returns early, and the "up"
  // direction never applies — printing a minute EARLY for an earliest-permitted
  // time. Reintroducing `true` turns these back to 5:21/5:24.
  // Measured at TORONTO_LOCATION's real coordinates (43.6629, -79.3957).
  // With `true` these read 5:21 and 5:25 — a minute early.
  it.each([
    [day(2026, 8, 1), "5:22 AM"],
    [day(2026, 8, 4), "5:26 AM"],
  ])("rounds up rather than truncating (%s)", (d, expected) => {
    const { zmanim } = getZmanimForDate(d, TORONTO_LOCATION);
    expect(formatZmanByKey("misheyakir45", zmanim.misheyakir45, TZ)).toBe(expected);
  });
});

// The INVARIANT, not two hand-picked dates (spec section 6.1). A zman that
// reaches roundZman already at :00 seconds silently loses its rounding policy —
// its ZMAN_DIRECTION entry stays present and the coverage test keeps passing,
// which is how this shipped to production twice.
//
// havdalah is excluded: it is now the same Date object as tzait by construction
// (commit e78c6dc), so it is covered by tzait's own row here.
describe("no zman reaches roundZman pre-rounded", () => {
  it("every zman carries real seconds on at least most days of a month", () => {
    const preRounded: Record<string, number> = {};
    for (let d = 1; d <= 31; d++) {
      const { zmanim } = getZmanimForDate(day(2026, 8, d), TORONTO_LOCATION);
      for (const [k, v] of Object.entries(zmanim)) {
        if ((v as Date).getSeconds() === 0) preRounded[k] = (preRounded[k] ?? 0) + 1;
      }
    }
    // A genuine :00 lands about 1 day in 60 by chance. A zman that is
    // systematically pre-rounded shows up at or near 31.
    const systematic = Object.entries(preRounded).filter(([, n]) => n > 3);
    expect(systematic).toEqual([]);
  });
});

describe("rounding registration", () => {
  it("registers both as permitted-from times", () => {
    expect(ZMAN_DIRECTION.alotHaShachar72).toBe("up");
    expect(ZMAN_DIRECTION.misheyakir45).toBe("up");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project unit tests/unit/zmanim-new-zmanim.test.ts`
Expected: FAIL — `alotHaShachar72` is undefined.

- [ ] **Step 3: Add the two zmanim**

In `src/lib/zmanim.ts`, add to the `ZmanimTimes` interface after `alotHaShachar`:

```ts
  /** Fixed 72 clock minutes before sunrise (not degree-based). */
  alotHaShachar72: Date;
```

and after `misheyakir`:

```ts
  /** Fixed 45 clock minutes before sunrise. */
  misheyakir45: Date;
```

Then in the `zmanimTimes` object literal:

```ts
    alotHaShachar: zmanim.alotHaShachar(),
    alotHaShachar72: zmanim.alotHaShachar72(),
    misheyakir: zmanim.timeAtAngle(10.2, true),
    // sunriseOffset's second argument is named `roundMinute` but TRUNCATES
    // seconds. Passing `true` hands roundZman a value already at :00, so its
    // "up" direction silently never applies and this prints a minute EARLY —
    // on an earliest-permitted time. Keep `false`; roundZman owns rounding.
    misheyakir45: zmanim.sunriseOffset(-45, false),
```

In `src/lib/zmanim-format.ts`, add to the permitted-from block of `ZMAN_DIRECTION`:

```ts
  alotHaShachar72: "up",
  misheyakir45: "up",
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run --project unit tests/unit/zmanim-new-zmanim.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Regenerate the snapshot — deliberately**

The snapshot now legitimately gains two fields.

Run: `TZ=UTC npx vite-node -c vitest.config.mts scripts/generate-zmanim-snapshot.ts && npx vitest run --project unit`
Expected: all pass.

> Regenerating is correct **only** because we intentionally added fields. If the snapshot ever fails for a value you did not intend to change, that is a regression — investigate, do not regenerate.

- [ ] **Step 6: Commit**

```bash
git add src/lib/zmanim.ts src/lib/zmanim-format.ts tests/unit/zmanim-new-zmanim.test.ts tests/fixtures/zmanim-snapshot.json
git commit -m "feat(zmanim): add alos 72 min and misheyakir 45 min

misheyakir45 uses sunriseOffset(-45, false). The `true` variant truncates
seconds, which hands roundZman a value already at :00 — roundZman returns
early on a zero remainder, so the registered \"up\" direction never applies
and the time prints a minute early. For an earliest-permitted time, early
is the unsafe direction."
```

---

### Task 6: `labelsForDate` — every applicable label, including Rosh Chodesh

Spec §6.7. `specialDay` misses `ROSH_CHODESH` entirely and is last-write-wins. It is left untouched (the week view and API consume it); this is additive.

**Files:**
- Modify: `src/lib/zmanim.ts`
- Test: `tests/unit/zmanim-labels.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/zmanim-labels.test.ts
import { describe, it, expect } from "vitest";
import { labelsForDate } from "@/lib/zmanim";
import { TORONTO_LOCATION } from "@/lib/zmanim-location";

const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

describe("labelsForDate", () => {
  it("labels Rosh Chodesh, which specialDay never captured", () => {
    // 2026-08-13 is 30 Av 5786 — Rosh Chodesh Elul.
    expect(labelsForDate(day(2026, 8, 13), TORONTO_LOCATION).join(" ")).toMatch(/Rosh Chodesh/);
  });

  it("returns every applicable label, not just the last one", () => {
    // Rosh Hashana 5787 begins Fri 2026-09-11 (erev).
    const labels = labelsForDate(day(2026, 9, 12), TORONTO_LOCATION);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.join(" ")).toMatch(/Rosh Hashana/);
  });

  it("labels fast days", () => {
    expect(labelsForDate(day(2026, 9, 14), TORONTO_LOCATION).join(" ")).toMatch(/Tzom Gedaliah/);
  });

  it("returns an empty array on an ordinary weekday", () => {
    expect(labelsForDate(day(2026, 8, 4), TORONTO_LOCATION)).toEqual([]);
  });

  it("never includes candle lighting or havdalah, which have their own columns", () => {
    const labels = labelsForDate(day(2026, 9, 11), TORONTO_LOCATION);
    expect(labels.join(" ")).not.toMatch(/Candle lighting|Havdalah/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project unit tests/unit/zmanim-labels.test.ts`
Expected: FAIL — `labelsForDate` is not exported.

- [ ] **Step 3: Implement — append to `src/lib/zmanim.ts`**

```ts
/**
 * Every label applicable to a date: Yom Tov, Rosh Chodesh, fast days, Chol
 * Hamoed.
 *
 * `ZmanimResponse.specialDay` cannot serve the sheet: it omits
 * flags.ROSH_CHODESH entirely, and it is a single last-write-wins string, so a
 * day that is both Rosh Chodesh and Chanukah collapses to one arbitrary label.
 * It is left exactly as-is because the week view and the API consume it.
 */
export function labelsForDate(
  date: Date,
  location: ZmanimLocation = TORONTO_LOCATION,
): string[] {
  const dayDate = anchorCalendarDate(date);
  const events = HebrewCalendar.calendar({
    start: dayDate,
    end: dayDate,
    location: toHebcalLocation(location),
    il: location.isIsrael,
    sedrot: false,
    candlelighting: false,
  });

  const WANTED =
    flags.CHAG |
    flags.ROSH_CHODESH |
    flags.MINOR_FAST |
    flags.MAJOR_FAST |
    flags.MINOR_HOLIDAY |
    flags.CHOL_HAMOED;

  const labels: string[] = [];
  for (const ev of events) {
    if (ev.getFlags() & WANTED) {
      const desc = ev.getDesc();
      if (!labels.includes(desc)) labels.push(desc);
    }
  }
  return labels;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run --project unit tests/unit/zmanim-labels.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/zmanim.ts tests/unit/zmanim-labels.test.ts
git commit -m "feat(zmanim): labelsForDate returns every applicable day label

specialDay omits flags.ROSH_CHODESH entirely and is single last-write-wins,
so a day that is both Rosh Chodesh and Chanukah collapses to one arbitrary
label. Left untouched since the week view and API consume it; this is
additive and is what the sheet's left column reads."
```

---

### Task 7: `getZmanimForRange`

**Files:**
- Modify: `src/lib/zmanim.ts`
- Test: `tests/unit/zmanim-range.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/zmanim-range.test.ts
import { describe, it, expect } from "vitest";
import { getZmanimForRange } from "@/lib/zmanim";
import { TORONTO_LOCATION } from "@/lib/zmanim-location";

const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

describe("getZmanimForRange", () => {
  it("returns one entry per day, inclusive of both ends", () => {
    expect(getZmanimForRange(day(2026, 8, 1), day(2026, 8, 31), TORONTO_LOCATION)).toHaveLength(31);
  });

  it("returns a single day when from === to", () => {
    expect(getZmanimForRange(day(2026, 8, 1), day(2026, 8, 1), TORONTO_LOCATION)).toHaveLength(1);
  });

  // NOTE: ZmanimResponse.date is a locale-formatted ENGLISH STRING, not a Date,
  // so asserting on it proves nothing about anchoring — a setDate() version
  // yields 5 distinct strings too. Assert on the underlying instants instead.
  it("keeps every day exactly 24h apart across a DST transition", () => {
    // Toronto DST ends 2026-11-01.
    const rows = getZmanimForRange(day(2026, 10, 30), day(2026, 11, 3), TORONTO_LOCATION);
    expect(rows).toHaveLength(5);

    // chatzot is a real Date on each row; consecutive days must not drift by an
    // hour across the transition, which is what setDate() would do.
    const noons = rows.map((r) => r.zmanim.chatzot.getTime());
    const gaps = noons.slice(1).map((t, i) => t - noons[i]);
    for (const g of gaps) {
      // Solar noon shifts a few minutes a day, but never by ~an hour.
      expect(Math.abs(g - 86_400_000)).toBeLessThan(10 * 60_000);
    }
  });

  it("returns an empty array when to is before from", () => {
    expect(getZmanimForRange(day(2026, 8, 5), day(2026, 8, 1), TORONTO_LOCATION)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project unit tests/unit/zmanim-range.test.ts`
Expected: FAIL — `getZmanimForRange` is not exported.

- [ ] **Step 3: Implement — append to `src/lib/zmanim.ts`**

```ts
/**
 * Zmanim for every civil day in [from, to], inclusive.
 *
 * Uses addAnchoredDays rather than setDate so each day stays pinned at exactly
 * 12:00 UTC — a DST transition inside the range must not duplicate or skip a
 * civil day.
 */
export function getZmanimForRange(
  from: Date,
  to: Date,
  location: ZmanimLocation = TORONTO_LOCATION,
): ZmanimResponse[] {
  const start = anchorCalendarDate(from);
  const end = anchorCalendarDate(to);
  if (end.getTime() < start.getTime()) return [];

  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  const out: ZmanimResponse[] = [];
  for (let i = 0; i <= days; i++) {
    out.push(getZmanimForDate(addAnchoredDays(start, i), location));
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run --project unit tests/unit/zmanim-range.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/zmanim.ts tests/unit/zmanim-range.test.ts
git commit -m "feat(zmanim): getZmanimForRange for the month sheet"
```

---

### Task 8: Extract the location parser, and validate `tzid` for real

Spec §8. `parseLocation` is module-private and its 400 semantics are the opposite of what a page needs. A bogus `tzid` currently reaches `toLocaleTimeString` and throws — a 500 on the API, a **blank error page** on a server-rendered route.

**Files:**
- Create: `src/lib/zmanim-location-params.ts`
- Modify: `src/app/api/zmanim/route.ts` (delete the private `parseLocation`, import instead)
- Test: `tests/unit/zmanim-location-params.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/zmanim-location-params.test.ts
import { describe, it, expect } from "vitest";
import { parseLocationParams, parseLocationParamsOrToronto } from "@/lib/zmanim-location-params";
import { TORONTO_LOCATION } from "@/lib/zmanim-location";

const p = (s: string) => new URLSearchParams(s);

describe("parseLocationParams (strict — the API contract)", () => {
  it("defaults to Toronto when no location params are present", () => {
    const r = parseLocationParams(p(""));
    expect("location" in r && r.location).toEqual(TORONTO_LOCATION);
  });

  it("accepts a complete valid set", () => {
    const r = parseLocationParams(p("lat=31.77&lon=35.21&tzid=Asia/Jerusalem&label=Jerusalem&il=1"));
    expect("location" in r).toBe(true);
    if ("location" in r) {
      expect(r.location.lat).toBeCloseTo(31.77);
      expect(r.location.isIsrael).toBe(true);
    }
  });

  it.each(["lat=999&lon=0&tzid=UTC", "lat=&lon=0&tzid=UTC", "lat=43&lon=500&tzid=UTC"])(
    "rejects out-of-range coordinates (%s)",
    (qs) => expect("error" in parseLocationParams(p(qs))).toBe(true)
  );

  // The 500-on-a-page bug: non-empty was the only check, so this reached
  // toLocaleTimeString and threw a RangeError.
  it("rejects a tzid that is not a real IANA zone", () => {
    expect("error" in parseLocationParams(p("lat=43&lon=-79&tzid=Nowhere/Fake"))).toBe(true);
  });
});

describe("parseLocationParamsOrToronto (lenient — the page contract)", () => {
  it.each([
    "lat=999&lon=0&tzid=UTC",
    "lat=43&lon=-79&tzid=Nowhere/Fake",
    "lat=&lon=&tzid=",
  ])("falls back to Toronto rather than erroring (%s)", (qs) => {
    expect(parseLocationParamsOrToronto(p(qs))).toEqual(TORONTO_LOCATION);
  });

  it("still returns a valid location when the params are good", () => {
    expect(parseLocationParamsOrToronto(p("lat=31.77&lon=35.21&tzid=Asia/Jerusalem&label=Jerusalem")).tzid)
      .toBe("Asia/Jerusalem");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project unit tests/unit/zmanim-location-params.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Move the body of `parseLocation` from `src/app/api/zmanim/route.ts:16` into the new file, adding the IANA check:

```ts
// src/lib/zmanim-location-params.ts
//
// One parser, two honest contracts:
//   parseLocationParams        -> { location } | { error }   (API: error becomes a 400)
//   parseLocationParamsOrToronto -> ZmanimLocation            (page: always renders)
//
// The page contract cannot be the API's. A page that 400s on a stale bookmark
// shows a blank error; it must fall back and render.
import { TORONTO_LOCATION, type ZmanimLocation } from "@/lib/zmanim-location";

/** Is this a timezone Intl actually knows? Non-empty is NOT enough. */
function isValidTimeZone(tzid: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tzid });
    return true;
  } catch {
    return false;
  }
}

export function parseLocationParams(
  searchParams: URLSearchParams,
): { location: ZmanimLocation } | { error: string } {
  const latParam = searchParams.get("lat");
  const lonParam = searchParams.get("lon");
  const tzidParam = searchParams.get("tzid");

  if (latParam === null && lonParam === null && tzidParam === null) {
    return { location: TORONTO_LOCATION };
  }

  const lat = Number(latParam);
  const lon = Number(lonParam);

  if (latParam === null || latParam.trim() === "" || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { error: "Invalid or missing 'lat' (must be a number between -90 and 90)" };
  }
  if (lonParam === null || lonParam.trim() === "" || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    return { error: "Invalid or missing 'lon' (must be a number between -180 and 180)" };
  }
  if (tzidParam === null || tzidParam.trim().length === 0 || !isValidTimeZone(tzidParam)) {
    return { error: "Invalid or missing 'tzid' (must be a valid IANA timezone id)" };
  }

  return {
    location: {
      lat,
      lon,
      tzid: tzidParam,
      label: searchParams.get("label") || "Selected location",
      isIsrael: searchParams.get("il") === "1",
    },
  };
}

/** Page contract: any problem degrades to Toronto so the sheet always renders. */
export function parseLocationParamsOrToronto(searchParams: URLSearchParams): ZmanimLocation {
  const parsed = parseLocationParams(searchParams);
  return "location" in parsed ? parsed.location : TORONTO_LOCATION;
}
```

Then in `src/app/api/zmanim/route.ts`: delete the private `parseLocation` function and
replace its call site with `parseLocationParams(searchParams)`, importing it from
`@/lib/zmanim-location-params`. The 400 behaviour is unchanged.

**Clean up the imports** — `type ZmanimLocation` becomes unused once the function is gone.
`TORONTO_LOCATION` is still used further down the file, so keep it. `npx eslint` in Step 4
will fail on the unused import otherwise.

- [ ] **Step 4: Run to verify it passes, and that the API is unaffected**

Run: `npx vitest run --project unit`
Expected: all pass.

> The `tzid` change means a request that previously **500**ed now correctly **400**s. That is a fix, not a regression.

- [ ] **Step 5: Commit**

```bash
git add src/lib/zmanim-location-params.ts src/app/api/zmanim/route.ts tests/unit/zmanim-location-params.test.ts
git commit -m "refactor(zmanim): share the location parser, and validate tzid properly

The parser was module-private to the API route and returned 400 semantics,
which is the opposite of what a page needs — a page must fall back and
render rather than show a blank error on a stale bookmark. Two named
functions, two honest contracts, one implementation.

tzid was only checked for non-emptiness, so tzid=Nowhere/Fake passed
validation and threw a RangeError inside toLocaleTimeString: a 500 on the
API and a blank page on a server component. Now checked against Intl."
```

---

### Task 9: `zmanim-month-param.ts`

**Files:**
- Create: `src/lib/zmanim-month-param.ts`
- Test: `tests/unit/zmanim-month-param.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/zmanim-month-param.test.ts
import { describe, it, expect } from "vitest";
import { parseMonthParam } from "@/lib/zmanim-month-param";
import { TORONTO_LOCATION } from "@/lib/zmanim-location";

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("parseMonthParam", () => {
  it("expands YYYY-MM to the whole calendar month", () => {
    const r = parseMonthParam("2026-08", TORONTO_LOCATION);
    expect(iso(r.from)).toBe("2026-08-01");
    expect(iso(r.to)).toBe("2026-08-31");
  });

  it("handles a 30-day month", () => {
    expect(iso(parseMonthParam("2026-09", TORONTO_LOCATION).to)).toBe("2026-09-30");
  });

  it("handles February in a leap year", () => {
    expect(iso(parseMonthParam("2028-02", TORONTO_LOCATION).to)).toBe("2028-02-29");
  });

  it.each([null, "", "garbage", "2026-13", "2026-00", "1899-05", "2201-05", "26-8"])(
    "falls back to the current month for %s",
    (input) => {
      const r = parseMonthParam(input, TORONTO_LOCATION);
      expect(iso(r.from).slice(8)).toBe("01");
      expect(r.to.getTime()).toBeGreaterThan(r.from.getTime());
    }
  );

  it("anchors both ends at noon UTC", () => {
    const r = parseMonthParam("2026-08", TORONTO_LOCATION);
    expect(r.from.getUTCHours()).toBe(12);
    expect(r.to.getUTCHours()).toBe(12);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project unit tests/unit/zmanim-month-param.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/zmanim-month-param.ts
import { todayInLocation } from "@/lib/zmanim-day";
import { TORONTO_LOCATION, type ZmanimLocation } from "@/lib/zmanim-location";

export interface MonthRange {
  from: Date;   // first of the month, noon UTC
  to: Date;     // last of the month, noon UTC
  year: number;
  month: number; // 1-12
}

function monthRange(year: number, month: number): MonthRange {
  const from = new Date(Date.UTC(year, month - 1, 1, 12));
  // Day 0 of the NEXT month is the last day of this one.
  const to = new Date(Date.UTC(year, month, 0, 12));
  return { from, to, year, month };
}

/**
 * "YYYY-MM" -> that whole calendar month. Anything unparseable, out of range,
 * or absent -> the current month AS OBSERVED IN `location`.
 *
 * Never throws: this drives a public, linkable page, and a stale bookmark must
 * still render something useful.
 */
export function parseMonthParam(
  raw: string | null | undefined,
  location: ZmanimLocation = TORONTO_LOCATION,
): MonthRange {
  const match = /^(\d{4})-(\d{2})$/.exec((raw ?? "").trim());
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year >= 1900 && year <= 2200 && month >= 1 && month <= 12) {
      return monthRange(year, month);
    }
  }

  // NOT new Date() — the server runs UTC on Vercel, so "this month" must be
  // resolved in the viewer's location or it flips a day early near a boundary.
  const today = todayInLocation(location);
  return monthRange(today.getUTCFullYear(), today.getUTCMonth() + 1);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run --project unit tests/unit/zmanim-month-param.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/zmanim-month-param.ts tests/unit/zmanim-month-param.test.ts
git commit -m "feat(zmanim): month param parsing, always degrading to a renderable month"
```

---

### Task 10: `zmanim-sheet.ts` — rows, footnotes and fast days

Spec §5.2.1, §6.7. The component makes no placement decisions; this returns an ordered `SheetLine[]`.

**Files:**
- Create: `src/lib/zmanim-sheet.ts`
- Test: `tests/unit/zmanim-sheet.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/zmanim-sheet.test.ts
import { describe, it, expect } from "vitest";
import { buildSheetLines } from "@/lib/zmanim-sheet";
import { TORONTO_LOCATION } from "@/lib/zmanim-location";

const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
const rows = (l: ReturnType<typeof buildSheetLines>) => l.filter((x) => x.kind === "day");
const notes = (l: ReturnType<typeof buildSheetLines>) => l.filter((x) => x.kind === "footnote");

describe("buildSheetLines", () => {
  const august = buildSheetLines(day(2026, 8, 1), day(2026, 8, 31), TORONTO_LOCATION, day(2026, 8, 5));

  it("emits one day row per civil day", () => {
    expect(rows(august)).toHaveLength(31);
  });

  it("strips the year from the Hebrew date", () => {
    const first = rows(august)[0];
    expect(first.kind === "day" && first.hebrewDateShort).toBe("18 Av");
  });

  it("flags exactly one row as today", () => {
    expect(rows(august).filter((r) => r.kind === "day" && r.isToday)).toHaveLength(1);
  });

  it("places the molad footnote directly after its own day row", () => {
    const i = august.findIndex((l) => l.kind === "footnote" && /Molad for Elul/.test(l.text));
    expect(i).toBeGreaterThan(0);
    const before = august[i - 1];
    expect(before.kind).toBe("day");
    expect(before.kind === "day" && before.date.toISOString().slice(0, 10)).toBe("2026-08-13");
  });

  it("includes both footnotes for August 2026", () => {
    expect(notes(august).filter((n) => n.kind === "footnote" && /Molad|Kiddush Levanoh/.test(n.text)))
      .toHaveLength(2);
  });

  it("omits footnotes falling outside the range", () => {
    const short = buildSheetLines(day(2026, 8, 1), day(2026, 8, 10), TORONTO_LOCATION, day(2026, 8, 5));
    expect(notes(short)).toHaveLength(0);
  });

  it("labels Rosh Chodesh on its row", () => {
    const rc = rows(august).find((r) => r.kind === "day" && r.date.getUTCDate() === 13);
    expect(rc!.kind === "day" && rc!.labels.join(" ")).toMatch(/Rosh Chodesh/);
  });

  // The whole justification for labelsForDate replacing specialDay: a day that
  // is both Rosh Chodesh and Chanukah must keep BOTH labels, where specialDay
  // (last-write-wins) collapses them to one arbitrary string.
  it("keeps both labels on a day that is Rosh Chodesh and Chanukah", () => {
    const dec = buildSheetLines(day(2026, 12, 1), day(2026, 12, 31), TORONTO_LOCATION, day(2026, 12, 1));
    const multi = dec.filter(
      (l) => l.kind === "day" && l.labels.length > 1
    );
    expect(multi.length).toBeGreaterThan(0);
  });

  it("puts daf yomi on every row", () => {
    expect(rows(august).every((r) => r.kind === "day" && typeof r.dafYomi === "string")).toBe(true);
  });

  // Fast days: neither fast time is among the seventeen columns, and the two
  // Alos columns are ~15 min apart with nothing saying which starts the fast.
  it("emits fast begins/ends as a footnote on a fast day", () => {
    const sept = buildSheetLines(day(2026, 9, 1), day(2026, 9, 30), TORONTO_LOCATION, day(2026, 9, 5));
    const fast = sept.find((l) => l.kind === "footnote" && /Fast begins/.test(l.text));
    expect(fast).toBeDefined();
    expect(fast!.kind === "footnote" && fast!.text).toMatch(/Fast ends/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project unit tests/unit/zmanim-sheet.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3a: Export `toHebcalLocation`**

It is currently private at `src/lib/zmanim.ts:12`. `fastLine` needs it, and duplicating
the `new Location(...)` construction is how the two would drift apart.

```ts
export function toHebcalLocation(loc: ZmanimLocation): Location {
```

- [ ] **Step 3b: Implement**

```ts
// src/lib/zmanim-sheet.ts
//
// Pure. Turns a date range into the exact ordered list of lines the sheet
// renders, so ZmanimSheet.tsx contains no date arithmetic and makes no
// placement decisions.
import { HDate, HebrewCalendar, Zmanim } from "@hebcal/core";
import {
  getZmanimForRange,
  labelsForDate,
  toHebcalLocation,
  type ZmanimResponse,
} from "@/lib/zmanim";
import { dafYomiForDate } from "@/lib/daf-yomi";
import { moladFootnotesInRange } from "@/lib/kiddush-levana";
import { todayInLocation, anchorCalendarDate, addAnchoredDays } from "@/lib/zmanim-day";
import { formatZman } from "@/lib/zmanim-format";
import { TORONTO_LOCATION, type ZmanimLocation } from "@/lib/zmanim-location";

export interface SheetRow {
  kind: "day";
  date: Date;
  hebrewDateShort: string;
  zmanim: ZmanimResponse;
  labels: string[];
  dafYomi: string | null;
  isToday: boolean;
}

export interface FootnoteLine {
  kind: "footnote";
  text: string;
}

export type SheetLine = SheetRow | FootnoteLine;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** "30 Av 5786" -> "30 Av". A luach row shows the day and month, not the year. */
function stripHebrewYear(s: string): string {
  return s.replace(/\s+\d+$/, "");
}

/**
 * Fast start and end for a date, or null.
 *
 * These come from hebcal's own events rather than from our columns, because
 * "Fast ends" is tzeit(7.083°) — not one of the seventeen — and the fast STARTS
 * at Alos 16.1° while the adjacent Alos 72 column sits ~15 minutes later.
 */
function fastLine(date: Date, location: ZmanimLocation): string | null {
  // Detect WHETHER this is a fast day from hebcal's events, but compute the
  // TIMES ourselves.
  //
  // hebcal's Fast begins/Fast ends eventTime arrives PRE-ROUNDED to :00 seconds,
  // which trips the invariant in rule 4: roundZman would short-circuit and the
  // direction below would never apply. Measured for Tzom Gedaliah 2026-09-14:
  // real tzeit(7.083) = 20:04:23, hebcal's event = 20:04:00 — so routing the
  // event through roundZman prints 8:04 PM instead of 8:05 PM, a minute LENIENT
  // on a time that ends a fast, on a sheet pinned to a wall.
  //
  // An earlier draft used the events "so the sheet cannot disagree with the
  // site". That was wrong: "Fast begins"/"Fast ends" appear NOWHERE in src/, so
  // there is no site value to agree with.
  //
  // BOTH `location` and `candlelighting: true` are required for hebcal to emit
  // these at all. Verified: location alone emits nothing; candlelighting without
  // a location THROWS "options.candlelighting requires valid options.location".
  const events = HebrewCalendar.calendar({
    start: date,
    end: date,
    location: toHebcalLocation(location),
    il: location.isIsrael,
    candlelighting: true,
  });

  let hasBegins = false;
  let hasEnds = false;
  for (const ev of events) {
    const d = ev.getDesc();
    if (d === "Fast begins") hasBegins = true;
    if (d === "Fast ends") hasEnds = true;
  }
  if (!hasBegins && !hasEnds) return null;

  const z = new Zmanim(toHebcalLocation(location), date, false);
  const parts: string[] = [];
  // The fast BEGINS as a deadline — stop eating by then — so round DOWN.
  if (hasBegins) parts.push(`Fast begins ${formatZman(z.alotHaShachar(), location.tzid, "down")}`);
  // The fast ENDS as a permitted-from time, so round UP. 7.083 degrees is the
  // shiur hebcal itself uses for this row.
  if (hasEnds) parts.push(`Fast ends ${formatZman(z.tzeit(7.083), location.tzid, "up")}`);
  return parts.join("  ·  ");
}

export function buildSheetLines(
  from: Date,
  to: Date,
  location: ZmanimLocation = TORONTO_LOCATION,
  /** Injectable for tests. Defaults to today IN THE LOCATION, never the server. */
  today: Date = todayInLocation(location),
): SheetLine[] {
  const days = getZmanimForRange(from, to, location);
  const footnotes = moladFootnotesInRange(anchorCalendarDate(from), anchorCalendarDate(to));
  const todayIso = isoDay(anchorCalendarDate(today));

  // Index footnote text by the day it belongs after.
  const byDay = new Map<string, string[]>();
  const push = (d: Date, text: string) => {
    const k = isoDay(d);
    byDay.set(k, [...(byDay.get(k) ?? []), text]);
  };
  for (const f of footnotes) {
    if (f.moladCivilDate >= from && f.moladCivilDate <= to) push(f.moladCivilDate, f.moladLine);
    if (f.sofZmanCivilDate >= from && f.sofZmanCivilDate <= to) push(f.sofZmanCivilDate, f.sofZmanLine);
  }

  const lines: SheetLine[] = [];
  const start = anchorCalendarDate(from);
  for (let i = 0; i < days.length; i++) {
    // addAnchoredDays, not raw millisecond arithmetic — same result today, but
    // the helper is the one place this convention is documented.
    const date = addAnchoredDays(start, i);
    lines.push({
      kind: "day",
      date,
      hebrewDateShort: stripHebrewYear(new HDate(date).toString()),
      zmanim: days[i],
      labels: labelsForDate(date, location),
      dafYomi: dafYomiForDate(date),
      isToday: isoDay(date) === todayIso,
    });

    const fast = fastLine(date, location);
    if (fast) lines.push({ kind: "footnote", text: fast });

    for (const text of byDay.get(isoDay(date)) ?? []) {
      lines.push({ kind: "footnote", text });
    }
  }

  return lines;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run --project unit tests/unit/zmanim-sheet.test.ts`
Expected: PASS, 9 tests.

Reference values for Tzom Gedaliah, 2026-09-14 at `TORONTO_LOCATION`:
`alotHaShachar() = 05:28:54` → prints **5:28** (rounded down, a deadline);
`tzeit(7.083) = 20:04:23` → prints **8:05 PM** (rounded up, permitted-from).

Note 20:04:23 is 8 minutes before our Tzeis 8.5° column (20:12:23) and 37 before Tzeis 72
(20:41:30) — precisely why the fast times cannot be read off the existing columns. Note
also that our 8:05 PM is deliberately one minute later than hebcal's own pre-rounded
20:04:00 event: rounding up is the safe direction for a time that ends a fast.

- [ ] **Step 5: Commit**

```bash
git add src/lib/zmanim-sheet.ts tests/unit/zmanim-sheet.test.ts
git commit -m "feat(zmanim): build sheet lines with footnotes and fast times interleaved

Fast begins/ends come from hebcal's events rather than from our columns:
Fast ends is tzeit(7.083 deg), which is not one of the seventeen, and the
fast starts at Alos 16.1 while the adjacent Alos 72 column sits about
fifteen minutes later with nothing on the sheet saying which applies."
```

---

## Chunk 3: Parity fixtures, the route, print

### Task 11: Parity fixtures against the old sheet

Spec §11.0/§11.1. **Different job, different tolerance** from Task 1: ±1 minute, because our rounding is stringent and the old ASP site truncated.

**Files:**
- Create: `tests/fixtures/old-sheet-2026-08.ts`
- Create: `tests/fixtures/old-sheet-2026-09.ts` (holiday sample)
- Create: `tests/unit/zmanim-old-sheet-parity.test.ts`

- [ ] **Step 1: Transcribe the fixtures**

Transcribe from the screenshots into arrays of `{ date, alos161, alos72, misheyakir45, haneitz, szsMA, szsGra, sztGra, chatzos, minchaGedola, minchaKetana, plag, candles, shkia, tzeis85, tzeis72, dafYomi }`.

**Excluded from comparison, deliberately — all three by owner decision, not oversight:**
- **Misheyakir degree** — the fixture holds 11° values and we print 10.2° (§9.1). Comparing
  would either always fail or need a tolerance so wide it tests nothing.
- **Sof Zman Shema (MA)** — the fixture holds the fixed-72-minute values (9:11 on 5 Aug
  2026) and we print the 16.1° family (8:55), a **15-minute** difference by decision §9.3.
  Comparing would fail on **every row**.
- **Sof Zman Tefilah (MA)** — not on the old sheet; it is our addition (§9.2).

Both excluded columns are covered instead by the MyZmanim block at the end of this test
file — that is the only independent check on decisions §9.1 and §9.3, which between them
move two printed times by 6 and 15 minutes.

Still transcribe those columns into the fixture. They are useful evidence when someone
later asks "what did the old sheet actually say?", and the test simply does not read them.

September is a **partial** sample: transcribe only the holiday and fast rows (Rosh Hashana, Tzom Gedaliah, Yom Kippur, Sukkos) plus their neighbours. August contains **zero** chag and **zero** fast events, so it exercises only the ordinary weekday case.

- [ ] **Step 2: Write the comparison test**

```ts
// tests/unit/zmanim-old-sheet-parity.test.ts
import { describe, it, expect } from "vitest";
import { buildSheetLines } from "@/lib/zmanim-sheet";
import { getZmanimForDate } from "@/lib/zmanim";
import { formatZmanByKey } from "@/lib/zmanim-format";
import { TORONTO_LOCATION } from "@/lib/zmanim-location";
import { OLD_SHEET_2026_08 } from "../fixtures/old-sheet-2026-08";
import { OLD_SHEET_2026_09 } from "../fixtures/old-sheet-2026-09";

const TZ = TORONTO_LOCATION.tzid;
const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

/** Minutes between two "h:mm AM" strings, ignoring the day. */
function minutesApart(a: string, b: string): number {
  const parse = (s: string) => {
    const m = /^(\d+):(\d+)\s*([AP])M?$/i.exec(s.trim().replace(/([ap])m?$/i, "$1M"));
    if (!m) throw new Error(`unparseable time: ${s}`);
    let h = Number(m[1]) % 12;
    if (m[3].toUpperCase() === "P") h += 12;
    return h * 60 + Number(m[2]);
  };
  return Math.abs(parse(a) - parse(b));
}

describe("parity with the old FrumToronto sheet (August 2026)", () => {
  const lines = buildSheetLines(day(2026, 8, 1), day(2026, 8, 31), TORONTO_LOCATION, day(2026, 8, 1));
  const rows = lines.filter((l) => l.kind === "day");

  // ±1 minute: our per-row rounding is stringent (deadlines down, permitted-from
  // up) while the old ASP site truncated everything. This tolerance is why this
  // fixture CANNOT serve as the upgrade gate — see tests/unit/zmanim-snapshot.
  const TOLERANCE = 1;

  it.each(OLD_SHEET_2026_08)("$date", (expected) => {
    const row = rows.find(
      (r) => r.kind === "day" && r.date.toISOString().slice(0, 10) === expected.date
    );
    expect(row, `no row for ${expected.date}`).toBeDefined();
    if (row?.kind !== "day") throw new Error("unreachable");

    const mismatches: string[] = [];
    const check = (label: string, ours: string | null, theirs: string | undefined) => {
      if (!theirs) return; // column not transcribed for this row
      // A null `ours` means the column stopped being computed — that must fail,
      // not pass silently.
      if (!ours) { mismatches.push(`${label}: we produced no value`); return; }
      const delta = minutesApart(ours, theirs);
      if (delta > TOLERANCE) mismatches.push(`${label}: ours ${ours} vs sheet ${theirs} (${delta}m)`);
    };

    const z = row.zmanim.zmanim;
    check("alos16.1", formatZmanByKey("alotHaShachar", z.alotHaShachar, TZ), expected.alos161);
    check("alos72", formatZmanByKey("alotHaShachar72", z.alotHaShachar72, TZ), expected.alos72);
    check("misheyakir45", formatZmanByKey("misheyakir45", z.misheyakir45, TZ), expected.misheyakir45);
    check("haneitz", formatZmanByKey("sunrise", z.sunrise, TZ), expected.haneitz);
    // szsMA is deliberately NOT compared — see the exclusions note below.
    check("szsGra", formatZmanByKey("sofZmanShma", z.sofZmanShma, TZ), expected.szsGra);
    check("sztGra", formatZmanByKey("sofZmanTfilla", z.sofZmanTfilla, TZ), expected.sztGra);
    check("chatzos", formatZmanByKey("chatzot", z.chatzot, TZ), expected.chatzos);
    check("minchaGedola", formatZmanByKey("minchaGedola", z.minchaGedola, TZ), expected.minchaGedola);
    check("minchaKetana", formatZmanByKey("minchaKetana", z.minchaKetana, TZ), expected.minchaKetana);
    check("plag", formatZmanByKey("plagHaMincha", z.plagHaMincha, TZ), expected.plag);
    check("shkia", formatZmanByKey("sunset", z.sunset, TZ), expected.shkia);
    check("tzeis8.5", formatZmanByKey("tzait", z.tzait, TZ), expected.tzeis85);
    check("tzeis72", formatZmanByKey("tzait72", z.tzait72, TZ), expected.tzeis72);
    if (expected.candles) {
      check("candles", formatZmanByKey("candleLighting", row.zmanim.candleLighting, TZ), expected.candles);
    }
    if (expected.dafYomi) expect(row.dafYomi).toBe(expected.dafYomi);

    expect(mismatches).toEqual([]);
  });
});

// The month that actually matters. August 2026 has ZERO chag and ZERO fast
// events (measured), so it only exercises the ordinary weekday case. This is the
// sample the spec says to keep if transcription effort has to be cut.
describe("parity with the old sheet (September/October 2026 — the fall holidays)", () => {
  const lines = buildSheetLines(day(2026, 9, 1), day(2026, 10, 31), TORONTO_LOCATION, day(2026, 9, 1));
  const rows = lines.filter((l) => l.kind === "day");

  it.each(OLD_SHEET_2026_09)("$date", (expected) => {
    const row = rows.find(
      (r) => r.kind === "day" && r.date.toISOString().slice(0, 10) === expected.date
    );
    expect(row, `no row for ${expected.date}`).toBeDefined();
    // Same comparison body as August — extract a shared helper rather than
    // duplicating it; it is spelled out above only for readability.
  });
});

// The Misheyakir 10.2 degree column is EXCLUDED from the fixtures above (spec
// section 11.1) because the old sheet holds only 11-degree values. Comparing it
// to our own output would be circular — the test and the code would share any
// bug and agree. It is therefore checked against an INDEPENDENT source.
//
// This is the only external check on decision 14.4, which moves a printed time
// about six minutes for every reader of the old sheet.
describe("the excluded columns, against MyZmanim", () => {
  // Fetched from myzmanim.com/day.aspx?vars=75405214.8.5.2026 (Toronto).
  // MyZmanim publishes seconds; ours are in the second column for reference.
  //   Misheyakir "Sun is 10.2 degrees below horizon"      5:11:17  (ours 5:11:13)
  //   Latest Shema MA "Using 72 minutes as 16.1 degrees"  8:55:54  (ours 8:55:50)
  // Add more dates by fetching the same URL with a different M.D.YYYY suffix.
  // Do NOT generate these from our own code — that would be circular.
  const MYZMANIM: Array<{ date: string; misheyakir: string; szsMA: string }> = [
    { date: "2026-08-05", misheyakir: "5:11 AM", szsMA: "8:55 AM" },
  ];

  it.each(MYZMANIM)("misheyakir 10.2° on $date", ({ date, misheyakir }) => {
    const [y, m, d] = date.split("-").map(Number);
    const { zmanim } = getZmanimForDate(day(y, m, d), TORONTO_LOCATION);
    expect(minutesApart(formatZmanByKey("misheyakir", zmanim.misheyakir, TZ)!, misheyakir))
      .toBeLessThanOrEqual(1);
  });

  it.each(MYZMANIM)("sof zman shema (MA) on $date", ({ date, szsMA }) => {
    const [y, m, d] = date.split("-").map(Number);
    const { zmanim } = getZmanimForDate(day(y, m, d), TORONTO_LOCATION);
    expect(minutesApart(formatZmanByKey("sofZmanShmaMGA", zmanim.sofZmanShmaMGA, TZ)!, szsMA))
      .toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 3: Run**

Run: `npx vitest run --project unit tests/unit/zmanim-old-sheet-parity.test.ts`
Expected: PASS.

**Triage rule when a row fails:**
- A **single cell** off → re-read the screenshot; most likely a transcription slip. Fix the fixture.
- A **whole row** off → code defect.
- A **whole column** off → check column alignment in the transcription *first* (the most likely systematic transcription error looks exactly like a code defect), then treat as a code defect.

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/old-sheet-2026-08.ts tests/fixtures/old-sheet-2026-09.ts tests/unit/zmanim-old-sheet-parity.test.ts
git commit -m "test(zmanim): parity fixtures from the old sheet, August and the fall holidays

August 2026 contains zero chag and zero fast events, so it validates only
the ordinary weekday case; the September sample covers Rosh Hashana, Tzom
Gedaliah, Yom Kippur and Sukkos. Misheyakir degree and Sof Zman Tefilah
(MA) are excluded by decision, not oversight - see spec sections 9.1, 9.2."
```

---

### Task 12: The route

**Files:**
- Create: `src/app/(public)/zmanim/month/page.tsx`
- Create: `src/app/(public)/zmanim/month/ZmanimSheet.tsx`
- Create: `src/app/(public)/zmanim/month/MonthPicker.tsx`

- [ ] **Step 1: `page.tsx`**

```tsx
// src/app/(public)/zmanim/month/page.tsx
import type { Metadata } from "next";
import { buildSheetLines } from "@/lib/zmanim-sheet";
import { parseMonthParam } from "@/lib/zmanim-month-param";
import { parseLocationParamsOrToronto } from "@/lib/zmanim-location-params";
import { ZmanimSheet } from "./ZmanimSheet";
// print.css is created in Task 13. If you are doing Task 12 first, add this
// import at the END of Task 13 — `npm run dev` fails on a missing module.
import "./print.css";

// Redundant while next.config.ts has no cacheComponents, and deliberately so:
// it keeps "today" from being frozen at build time even if Cache Components is
// enabled later. Only this segment is affected — the week view at /zmanim stays
// static, which is the reason the sheet is its own route.
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

/** searchParams is a Promise in Next 15+. */
function toParams(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") p.set(k, v);
    else if (Array.isArray(v) && v[0]) p.set(k, v[0]);
  }
  return p;
}

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const params = toParams(await searchParams);
  const location = parseLocationParamsOrToronto(params);
  const { from } = parseMonthParam(params.get("month"), location);
  const label = from.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return {
    title: `Zmanim Calendar — ${label} — ${location.label}`,
    description: `Printable monthly zmanim calendar for ${location.label}: ${label}.`,
  };
}

export default async function ZmanimMonthPage({ searchParams }: { searchParams: SP }) {
  const params = toParams(await searchParams);
  const location = parseLocationParamsOrToronto(params);
  const range = parseMonthParam(params.get("month"), location);
  const lines = buildSheetLines(range.from, range.to, location);

  return <ZmanimSheet lines={lines} range={range} location={location} />;
}
```

- [ ] **Step 2: `ZmanimSheet.tsx`** — renders `SheetLine[]`; no date logic.

Requirements (spec §10):
- Wrapper carries `className="zmanim-sheet-print"`.
- Scroll container: `overflow-x-auto min-w-0 max-w-full`, `tabIndex={0}`, `aria-label="Zmanim table, scrolls horizontally"`.
- `<caption>` naming month and location.
- `scope="col"` on every `<th>`; `scope="row"` on the civil-day cell.
- Sticky `<thead>` **and** a sticky left identity block (day letter / day / Hebrew date).
- **Every heading carries its shita inline**: `Alos 16.1°`, `Alos 72 min`, `Misheyakir 10.2°`, `Misheyakir 45 min`, `Sof Zman Shema (MA)`, `Tzeis 8.5°`, `Tzeis 72 min`. This is mandatory (§11.4) — there is no rabbinic review, so a printed number must identify its own opinion.
- Footnote lines render as a full-width `<tr><td colSpan={21}>`.
- Today's row highlighted.
- Below the table, the **legend + disclaimer**, copied from `ZmanimPageContent.tsx:385-401`, ending *"Always verify times with your local Rabbi."* It **must print**.

- [ ] **Step 3: `MonthPicker.tsx`** — `"use client"`; month `<select>`, year input, `Go`, `‹`/`›`, and `<LocationPicker>`. Navigates with `router.push` preserving location params; writes location to both the URL and localStorage via the existing hook.

**`ZmanimSheet` must render `<MonthPicker>` above the table**, inside the
`.zmanim-sheet-print` wrapper and marked `no-print`. It is the spec's core UI (§4); a route
that ships without it has no month control at all. `page.tsx` renders only `<ZmanimSheet>`,
so the picker reaching the page depends entirely on this.

- [ ] **Step 4: Verify it builds and renders**

First create an empty `src/app/(public)/zmanim/month/print.css` so the import resolves —
Task 13 fills it in.

Run: `npm run dev`, then open `http://localhost:3000/zmanim/month`
Expected: August 2026 renders with 31 rows; `?month=2026-09` switches months; `?month=garbage` still renders the current month.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(public)/zmanim/month"
git commit -m "feat(zmanim): printable month sheet at /zmanim/month

Its own route segment so force-dynamic does not fall on the week view,
which is static today. Every column heading carries its shita inline and
the legend prints, since there is no rabbinic review step."
```

---

### Task 13: Print stylesheet

**Files:**
- Create: `src/app/(public)/zmanim/month/print.css`

- [ ] **Step 1: Write it, gated on the wrapper class**

```css
/* Gated on .zmanim-sheet-print. A bare `header { display: none }` here would
   also strip the header when printing the WEEK view, since a CSS import applies
   to the whole route. Header and Footer render in LayoutWrapper, outside this
   component, so they are targeted by sibling/global selectors under the gate. */
@media print {
  body:has(.zmanim-sheet-print) header,
  body:has(.zmanim-sheet-print) footer,
  .zmanim-sheet-print .no-print { display: none !important; }

  .zmanim-sheet-print { max-width: none; padding: 0; }
  .zmanim-sheet-print table { width: 100%; font-size: 8pt; }
  .zmanim-sheet-print thead { display: table-header-group; }
  .zmanim-sheet-print tr { page-break-inside: avoid; }
  /* The legend and disclaimer MUST print - see spec section 11.4. */
  .zmanim-sheet-print .sheet-legend { display: block !important; page-break-inside: avoid; }
  @page { size: landscape; margin: 10mm; }
}
```

Apply `no-print` to the month picker, location picker and back-link.

- [ ] **Step 2: Verify**

Print-preview `/zmanim/month` (Ctrl+P) and `/zmanim`.
Expected: the sheet prints landscape without site chrome, **with** the legend; the **week view still prints its header** — that is the leak this gate prevents.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(public)/zmanim/month/print.css"
git commit -m "feat(zmanim): print stylesheet for the month sheet, scoped so it cannot leak"
```

---

### Task 14: Links, and the duplicate location label

**Files:**
- Modify: `src/app/(public)/zmanim/ZmanimPageContent.tsx:187-190`
- Modify: `src/components/layout/Footer.tsx:80`

- [ ] **Step 1: Remove the duplicate label**

Delete the `<p className="text-gray-600 flex items-center gap-1">` block at lines 187-190 (the `<MapPin>` + `{location.label}`). The label remains in the `<h1>` at 184-186 and inside `LocationPicker.tsx:247`, which is the picker's own current-value display and is correct.

- [ ] **Step 2: Add a link to the sheet** near the date picker in `ZmanimPageContent.tsx`:

```tsx
<Link href="/zmanim/month" className="text-sm text-blue-600 hover:underline">
  Monthly calendar →
</Link>
```

- [ ] **Step 3: Add a footer link** after the existing `/zmanim` link in `Footer.tsx:80`.

- [ ] **Step 4: Verify**

Run: `npx vitest run --project unit && npx tsc --noEmit && npx eslint src/app/\(public\)/zmanim src/components/layout/Footer.tsx`
Expected: all pass, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(public)/zmanim/ZmanimPageContent.tsx" src/components/layout/Footer.tsx
git commit -m "feat(zmanim): link the month sheet, drop the duplicate location label

The location rendered three times on /zmanim: the h1, a redundant
paragraph below it, and the picker's own current-value display. The middle
one is removed."
```

---

### Task 15: Extend the server-timezone relocation test

Spec §11.3. `tests/unit/zmanim-calc.test.ts:207` already relocates the "server" across
`UTC / Asia/Tokyo / Asia/Kolkata / America/Toronto / America/Los_Angeles` via
`process.env.TZ`. Two of this feature's units must join that sweep.

This is not ceremony: `moladCivilDate` reads `getUTCDate()` off `HDate.greg()`, which
returns **local** midnight. Measured before the `anchorCalendarDate` fix, Asia/Tokyo and
Pacific/Auckland put Sh'vat 5793's molad on **2032-12-25 instead of 2033-01-01** — a full
week out. The unit project is pinned `TZ=UTC`, so nothing else in the suite can catch it.

**Files:**
- Modify: `tests/unit/zmanim-calc.test.ts`

- [ ] **Step 1: Add to the existing relocation describe block**

```ts
it.each(["UTC", "Asia/Tokyo", "Asia/Kolkata", "America/Toronto", "America/Los_Angeles"])(
  "molad civil dates are identical with the server in %s",
  async (tz) => {
    const original = process.env.TZ;
    process.env.TZ = tz;
    try {
      const { moladFootnotesInRange } = await import("@/lib/kiddush-levana");
      const f = moladFootnotesInRange(
        new Date(Date.UTC(2032, 11, 29, 12)),
        new Date(Date.UTC(2033, 0, 4, 12))
      );
      // Sh'vat 5793 — a zero-distance month, the case that shifts a full week
      // when greg()'s local midnight is read as UTC.
      expect(f.map((x) => x.moladCivilDate.toISOString().slice(0, 10))).toContain("2033-01-01");
    } finally {
      process.env.TZ = original;
    }
  }
);

it.each(["UTC", "Asia/Tokyo", "America/Los_Angeles"])(
  "getZmanimForRange returns the same civil days in %s",
  async (tz) => {
    const original = process.env.TZ;
    process.env.TZ = tz;
    try {
      const { getZmanimForRange } = await import("@/lib/zmanim");
      const rows = getZmanimForRange(
        new Date(Date.UTC(2026, 7, 1, 12)),
        new Date(Date.UTC(2026, 7, 5, 12)),
        TORONTO_LOCATION
      );
      expect(rows).toHaveLength(5);
      expect(rows[0].date).toContain("August 1");
    } finally {
      process.env.TZ = original;
    }
  }
);
```

> **`process.env.TZ` set mid-process does not always take effect** — Node caches the zone.
> Follow whatever mechanism `zmanim-calc.test.ts:207` already uses (it works there); if a
> relocation assertion passes suspiciously easily, verify it fails with the bug
> reintroduced before trusting it.

- [ ] **Step 2: Run**

Run: `npx vitest run --project unit tests/unit/zmanim-calc.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/zmanim-calc.test.ts
git commit -m "test(zmanim): relocate the server for range and molad derivation

HDate.greg() returns local midnight, so reading getUTCDate() off it shifts
a day on any positive-offset machine - Sh'vat 5793's molad landed a full
week early in Asia/Tokyo. The unit project is pinned TZ=UTC, so only this
sweep can catch that class of defect."
```

---

### Task 16: Final verification

- [ ] **Step 1: Full suite**

Run: `npx vitest run --project unit`
Expected: all pass, including snapshot and parity.

- [ ] **Step 2: Types and lint**

Run: `npx tsc --noEmit` → 0 errors.
Run: `npx eslint src/lib/zmanim-sheet.ts src/lib/kiddush-levana.ts src/lib/daf-yomi.ts src/lib/zmanim-month-param.ts src/lib/zmanim-location-params.ts "src/app/(public)/zmanim/month"` → 0 errors.

> The repo has a pre-existing eslint baseline of unrelated errors elsewhere. Do not fix those; do not let new ones in.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds; `/zmanim/month` listed as **dynamic (ƒ)** and `/zmanim` still **static (○)**. If `/zmanim` became dynamic, the segment config leaked — that is the regression this route split exists to prevent.

- [ ] **Step 4: Manual checks**

- Print preview at A4 and Letter, landscape and portrait.
- `?month=2026-09` — Rosh Hashana, Tzom Gedaliah and Yom Kippur rows carry fast times and labels.
- A shared URL with `lat`/`lon`/`tzid` opened in a second browser profile shows the sender's location.
- At 375px width: the **table** scrolls horizontally but the page **body** does not (no grey band on the right).
- `/zmanim/month?month=garbage&lat=999&tzid=Nowhere/Fake` renders the current month in Toronto — no error page.

- [ ] **Step 5: Update project docs**

Add a session entry to `CLAUDE.md` covering the route, the two rounding bugs and the invariant, the decisions in spec §14 (especially Misheyakir 10.2° and no rav review), and the measured-clean hebcal upgrade.

```bash
git add CLAUDE.md
git commit -m "docs: record the zmanim month sheet work"
```

---

## Appendix: things that will look like bugs but are not

| Observation | Explanation |
|---|---|
| Sheet and MyZmanim differ by a minute | Our rounding is stringent by row; MyZmanim rounds to nearest. Deliberate — spec §9.3. |
| Molad prints `8:15 AM` regardless of viewer location | The molad is stated in the traditional fixed reckoning, never localised. The only such time on the sheet. |
| Misheyakir reads 5:06 where the old sheet said 5:01 | Owner's decision, §9.1. We print 10.2°, the old sheet printed 11°. **Do not "fix".** |
| Sof Zman Shema (MA) reads 8:55 where the old sheet said 9:11 | Owner's decision, §9.3. `sofZmanShmaMGA16Point1()` (16.1°) vs the old sheet's `sofZmanShmaMGA()` (fixed 72 min) — 15 minutes, in the stringent direction. MyZmanim agrees with us to 4 seconds. **Do not "fix".** |
| Sof Zman Tefilah (MA) exists but the old sheet lacks it | Owner's decision, §9.2. |
| Candle lighting is 40 min before sunset in Jerusalem, 18 in Toronto | hebcal applies per-city custom by coordinate. Measured. |
| Candle lighting column is empty on most rows | Only Fridays and Yom Tov eves have one. |
| The second night of Yom Tov shows candle lighting *after* sunset | Correct — that lighting is after tzeis from an existing flame. Verified Sep 12 2026 = 8:16 PM. |
