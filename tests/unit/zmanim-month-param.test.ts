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
