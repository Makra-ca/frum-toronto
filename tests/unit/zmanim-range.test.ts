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
