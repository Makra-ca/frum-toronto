import { describe, it, expect } from "vitest";
import { dafYomiForDate } from "@/lib/daf-yomi";

const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

describe("dafYomiForDate", () => {
  // Daf numbers transcribed from the old sheet, August 2026. The SPELLING is
  // hebcal's: it renders "Chullin", the old sheet printed "Chulin". The daf
  // numbers are what prove the right calendar and il flag; the spelling is a
  // display question, deliberately not hand-mapped (a tractate-name lookup
  // table is a maintenance liability for one doubled letter).
  it.each([
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
