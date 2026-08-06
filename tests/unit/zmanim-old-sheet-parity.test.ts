import { describe, it, expect } from "vitest";
import { buildSheetLines } from "@/lib/zmanim-sheet";
import { getZmanimForDate } from "@/lib/zmanim";
import { formatZmanByKey } from "@/lib/zmanim-format";
import { TORONTO_LOCATION } from "@/lib/zmanim-location";
import { OLD_SHEET_2026_08 } from "../fixtures/old-sheet-2026-08";

const TZ = TORONTO_LOCATION.tzid;
const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

/** Minutes between two "h:mm AM" / "h:mmam" strings, ignoring the day. */
function minutesApart(a: string, b: string): number {
  const parse = (s: string) => {
    const m = /^(\d{1,2}):(\d{2})\s*([ap])m?$/i.exec(s.trim());
    if (!m) throw new Error(`unparseable time: ${JSON.stringify(s)}`);
    let h = Number(m[1]) % 12;
    if (m[3].toLowerCase() === "p") h += 12;
    return h * 60 + Number(m[2]);
  };
  return Math.abs(parse(a) - parse(b));
}

// ---------------------------------------------------------------------------
// PARITY, not regression. Tolerance is +/-1 minute because our rounding is
// stringent per row (deadlines down, permitted-from up) while the old ASP site
// rounded differently. That tolerance is exactly why this fixture CANNOT serve
// as the gate on a library upgrade — see tests/unit/zmanim-snapshot.test.ts,
// which is the same comparison at zero tolerance.
// ---------------------------------------------------------------------------
const TOLERANCE = 1;

describe("parity with the old FrumToronto sheet (1-8 August 2026)", () => {
  const rows = buildSheetLines(
    day(2026, 8, 1),
    day(2026, 8, 8),
    TORONTO_LOCATION,
    day(2026, 8, 1),
  ).filter((l) => l.kind === "day");

  it.each(OLD_SHEET_2026_08)("$date", (expected) => {
    const row = rows.find(
      (r) => r.kind === "day" && r.date.toISOString().slice(0, 10) === expected.date,
    );
    expect(row, `no row built for ${expected.date}`).toBeDefined();
    if (row?.kind !== "day") throw new Error("unreachable");

    const mismatches: string[] = [];
    const check = (label: string, ours: string | null, theirs: string | undefined) => {
      if (!theirs) return; // column not transcribed for this row
      // A null `ours` means the column stopped being computed. That must fail
      // loudly rather than pass by skipping.
      if (!ours) {
        mismatches.push(`${label}: we produced no value (sheet says ${theirs})`);
        return;
      }
      const delta = minutesApart(ours, theirs);
      if (delta > TOLERANCE) {
        mismatches.push(`${label}: ours ${ours} vs sheet ${theirs} (${delta} min apart)`);
      }
    };

    const z = row.zmanim.zmanim;
    check("alos16.1", formatZmanByKey("alotHaShachar", z.alotHaShachar, TZ), expected.alos161);
    check("alos72", formatZmanByKey("alotHaShachar72", z.alotHaShachar72, TZ), expected.alos72);
    check("misheyakir45", formatZmanByKey("misheyakir45", z.misheyakir45, TZ), expected.misheyakir45);
    check("haneitz", formatZmanByKey("sunrise", z.sunrise, TZ), expected.haneitz);
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
      check(
        "candles",
        formatZmanByKey("candleLighting", row.zmanim.candleLighting, TZ),
        expected.candles,
      );
    }

    // szsMA_72min and misheyakir11 are intentionally NOT compared — see the
    // fixture header and the MyZmanim block below.

    expect(mismatches).toEqual([]);
  });

  it("puts the right daf on every transcribed row", () => {
    for (const expected of OLD_SHEET_2026_08) {
      const row = rows.find(
        (r) => r.kind === "day" && r.date.toISOString().slice(0, 10) === expected.date,
      );
      if (row?.kind !== "day") throw new Error(`no row for ${expected.date}`);
      expect(row.dafYomi, expected.date).toBe(expected.dafYomi);
    }
  });
});

// ---------------------------------------------------------------------------
// The two columns excluded above, checked against an INDEPENDENT source.
//
// They cannot be compared to the old sheet (we deliberately print different
// shitos), and comparing them to our own output would be circular — the test
// and the code would share any bug and agree. MyZmanim is the third party, and
// is what the site's zmanim were originally verified against.
//
// This is the only external check on decisions §9.1 and §9.3, which between
// them move two printed times by 6 and 15 minutes.
//
// Values fetched from myzmanim.com/day.aspx?vars=75405214.8.5.2026 (Toronto).
// MyZmanim publishes seconds; ours in brackets for reference.
//   Misheyakir "Sun is 10.2 degrees below horizon"      5:11:17  (ours 5:11:13)
//   Latest Shema MA "Using 72 minutes as 16.1 degrees"  8:55:54  (ours 8:55:50)
// Add dates by fetching the same URL with a different M.D.YYYY suffix. Do NOT
// generate these from our own code.
// ---------------------------------------------------------------------------
describe("the excluded columns, against MyZmanim", () => {
  const MYZMANIM = [{ date: "2026-08-05", misheyakir: "5:11 AM", szsMA: "8:55 AM" }];

  it.each(MYZMANIM)("misheyakir 10.2 degrees on $date", ({ date, misheyakir }) => {
    const [y, m, d] = date.split("-").map(Number);
    const { zmanim } = getZmanimForDate(day(y, m, d), TORONTO_LOCATION);
    const ours = formatZmanByKey("misheyakir", zmanim.misheyakir, TZ)!;
    expect(minutesApart(ours, misheyakir)).toBeLessThanOrEqual(1);
  });

  it.each(MYZMANIM)("sof zman shema (MA) on $date", ({ date, szsMA }) => {
    const [y, m, d] = date.split("-").map(Number);
    const { zmanim } = getZmanimForDate(day(y, m, d), TORONTO_LOCATION);
    const ours = formatZmanByKey("sofZmanShmaMGA", zmanim.sofZmanShmaMGA, TZ)!;
    expect(minutesApart(ours, szsMA)).toBeLessThanOrEqual(1);
  });

  // Proof that the exclusion above is a real divergence and not an oversight:
  // if we ever silently switched to the old sheet's fixed-72-minute shita, this
  // would go red.
  it("differs from the old sheet's fixed-72-minute shita by about 15 minutes", () => {
    const { zmanim } = getZmanimForDate(day(2026, 8, 5), TORONTO_LOCATION);
    const ours = formatZmanByKey("sofZmanShmaMGA", zmanim.sofZmanShmaMGA, TZ)!;
    expect(minutesApart(ours, "9:11am")).toBeGreaterThanOrEqual(14);
  });
});
