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
// the PARITY fixture allows. Loosening this makes it useless.
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
