import { describe, it, expect } from "vitest";
import { getZmanimForDate, formatZmanTime } from "@/lib/zmanim";
import { TORONTO_LOCATION } from "@/lib/zmanim-location";

const TZ = TORONTO_LOCATION.tzid;
const fmt = (d: Date | null) => formatZmanTime(d, TZ);

/** Noon-UTC anchor for a civil date, matching the library's own convention. */
const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

const secondsApart = (a: Date | null, b: Date) =>
  a === null ? Number.POSITIVE_INFINITY : Math.abs(a.getTime() - b.getTime()) / 1000;

// ---------------------------------------------------------------------------
// Layer 1 — golden values captured from MyZmanim for Toronto, 26 July 2026.
//
// Only MyZmanim's lead day publishes seconds, and only those values are used
// here. Its week-ahead table is deliberately NOT used as a fixture: it prints
// times to the minute, and rows are easy to misalign when transcribing. Our own
// sunsets that week fall 8:47:11 / 8:46:07 / 8:45:02 / 8:43:54 — a smooth ~65s
// per day decline — so any "flat then jumping" transcription is a transcription
// error, not a calculation error.
//
// Tolerance is 90s: MyZmanim ROUNDS to the nearest minute while formatZmanTime
// TRUNCATES, and the two implementations differ slightly on refraction. 90s is
// still far tighter than the ~24h error a day-boundary regression would cause.
// ---------------------------------------------------------------------------
describe("matches MyZmanim reference values (Toronto, 2026-07-26)", () => {
  const subject = getZmanimForDate(day(2026, 7, 26), TORONTO_LOCATION);

  const cases: Array<[string, Date | null, Date]> = [
    ["sunrise (6:00:36)", subject.zmanim.sunrise, new Date("2026-07-26T10:00:36Z")],
    ["sunset (8:47:13 PM)", subject.zmanim.sunset, new Date("2026-07-27T00:47:13Z")],
    ["tzeis, 3 stars (9:37:33 PM)", subject.zmanim.tzait, new Date("2026-07-27T01:37:33Z")],
    ["tzeis, 72 min (9:59:13 PM)", subject.zmanim.tzait72, new Date("2026-07-27T01:59:13Z")],
  ];

  it.each(cases)("%s is within 90s of MyZmanim", (_label, ours, theirs) => {
    expect(secondsApart(ours, theirs)).toBeLessThan(90);
  });

  it("candle lighting matches MyZmanim for Friday 31 July (8:23 PM)", () => {
    const friday = getZmanimForDate(day(2026, 7, 31), TORONTO_LOCATION);
    expect(fmt(friday.candleLighting)).toBe("8:23 PM");
  });
});

// ---------------------------------------------------------------------------
// Layer 2 — the DEFINITION is pinned, which is what makes agreement hold on the
// thousands of dates nobody will ever check by hand.
//
// MyZmanim labels its "Nightfall - 3 stars emerge" row "36 minutes as degrees",
// i.e. 8.5 degrees of solar depression — the same value our tzeis row uses and
// which matched MyZmanim to the second above. Havdalah must therefore be
// degree-based at 8.5 degrees, never a fixed minute count.
//
// hebcal rounds havdalah to the whole minute while tzeis keeps seconds, so the
// two may legitimately differ by up to 60s.
// ---------------------------------------------------------------------------
describe("havdalah is 8.5-degree nightfall, all year round", () => {
  // Every other Saturday across two years: both solstices, both equinoxes and
  // all four DST transitions.
  const saturdays: Date[] = [];
  for (let d = day(2026, 1, 3), i = 0; i < 52; i++) {
    saturdays.push(new Date(d));
    d = new Date(d.getTime() + 14 * 86_400_000);
  }

  it("tracks the 8.5-degree tzeis within a minute on every Shabbos tested", () => {
    const offenders: string[] = [];

    for (const sat of saturdays) {
      const r = getZmanimForDate(sat, TORONTO_LOCATION);
      const iso = sat.toISOString().slice(0, 10);

      if (!r.havdalah) {
        // A Shabbos that runs directly into Yom Tov has NO havdalah — candles
        // are lit for the festival instead. hebcal models this correctly, so the
        // absence is only legitimate when candle lighting is present.
        // Real examples in this range: 2026-09-12 (Rosh Hashana on Shabbos),
        // 2026-09-26 (first day Sukkos), 2027-10-23 (Shemini Atzeres).
        if (!r.candleLighting) {
          offenders.push(`${iso}: no havdalah AND no candle lighting`);
        }
        continue;
      }
      const delta = secondsApart(r.havdalah, r.zmanim.tzait);
      if (delta > 60) {
        offenders.push(
          `${iso}: havdalah ${fmt(r.havdalah)} vs tzeis ${fmt(r.zmanim.tzait)} (${delta}s apart)`
        );
      }
    }

    expect(offenders).toEqual([]);
  });

  it("is NOT a fixed number of minutes after sunset", () => {
    // A degree-based nightfall varies with the season; a fixed offset cannot.
    // Reverting to havdalahMins collapses this spread and fails the test.
    const minutes = saturdays
      .map((sat) => {
        const r = getZmanimForDate(sat, TORONTO_LOCATION);
        if (!r.havdalah) return null; // Shabbos running into Yom Tov
        return Math.round((r.havdalah.getTime() - r.zmanim.sunset.getTime()) / 60_000);
      })
      .filter((m): m is number => m !== null);

    expect(minutes.length).toBeGreaterThan(40);

    // Toronto's 8.5-degree nightfall runs roughly 39 min in midwinter to 55 min
    // near the summer solstice. A fixed 50-minute rule would give a spread of 0.
    const spread = Math.max(...minutes) - Math.min(...minutes);
    expect(spread).toBeGreaterThan(8);
  });

  it("always falls after sunset and before the 72-minute nightfall", () => {
    for (const sat of saturdays) {
      const r = getZmanimForDate(sat, TORONTO_LOCATION);
      if (!r.havdalah) continue;
      const iso = sat.toISOString().slice(0, 10);
      expect(r.havdalah.getTime(), iso).toBeGreaterThan(r.zmanim.sunset.getTime());
      expect(r.havdalah.getTime(), iso).toBeLessThan(r.zmanim.tzait72.getTime());
    }
  });
});

// ---------------------------------------------------------------------------
// Layer 3 — cross-check the 8.5-degree time against the published NOAA solar
// equations, implemented here from the formula rather than read out of hebcal.
//
// This is a sanity cross-check on inputs and usage — latitude sign, longitude
// convention, zenith, timezone handling — NOT a fully independent authority:
// hebcal's calculator derives from the same NOAA equations. The tolerance is
// generous (3 min) because this simplified form omits the refraction and
// day-fraction refinements hebcal applies; measured residual is ~75-90s.
// ---------------------------------------------------------------------------
function noaaTimeAtZenith(
  date: Date,
  lat: number,
  /** Positive WEST, per the NOAA spreadsheet convention. */
  lonWest: number,
  zenithDeg: number,
): Date {
  const rad = Math.PI / 180;
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - yearStart) / 86_400_000) + 1;

  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + 0.5);
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const cosHa =
    Math.cos(zenithDeg * rad) / (Math.cos(lat * rad) * Math.cos(decl)) -
    Math.tan(lat * rad) * Math.tan(decl);
  const hourAngle = Math.acos(Math.min(1, Math.max(-1, cosHa))) / rad;

  const minutesUtc = 720 + 4 * (lonWest + hourAngle) - eqTime;
  const midnightUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return new Date(midnightUtc + minutesUtc * 60_000);
}

describe("8.5-degree nightfall agrees with the published NOAA equations", () => {
  const monthly = Array.from({ length: 12 }, (_, i) => day(2026, i + 1, 15));

  it("stays within 3 minutes for all twelve months", () => {
    const offenders: string[] = [];

    for (const date of monthly) {
      const ours = getZmanimForDate(date, TORONTO_LOCATION).zmanim.tzait;
      const reference = noaaTimeAtZenith(
        date,
        TORONTO_LOCATION.lat,
        -TORONTO_LOCATION.lon, // stored lon is negative-west; NOAA wants positive-west
        90 + 8.5,
      );
      const delta = secondsApart(ours, reference);
      if (delta >= 180) {
        offenders.push(`${date.toISOString().slice(0, 10)}: ${Math.round(delta)}s apart`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
