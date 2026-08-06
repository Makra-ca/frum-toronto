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
  it("handles a molad whose sof zman crosses a Gregorian month boundary", () => {
    // The window matters. A molad always falls in the first half of a
    // Gregorian month during part of the year, and sof zman is only ~15 days
    // later, so Aug-Sep 2026 contains NO crossing at all (Elul 08-13 -> 08-28,
    // Tishrei 09-11 -> 09-26). Sept-Oct 2027 does: Tishrei 5788's molad is
    // 2027-09-30 and its sof zman 2027-10-15.
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
