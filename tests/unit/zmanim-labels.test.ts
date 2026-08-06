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
