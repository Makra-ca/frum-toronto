// scripts/generate-zmanim-snapshot.ts
// Captures the CURRENT tree's zmanim output so an upgrade can be diffed against
// it at zero tolerance. Regenerate ONLY when a change to output is intended.
//
// Run from the repo root (paths below are relative to cwd), and with TZ=UTC so
// the output matches the unit project, which is pinned to UTC:
//   TZ=UTC npx vite-node -c vitest.config.mts scripts/generate-zmanim-snapshot.ts
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
