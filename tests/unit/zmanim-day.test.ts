import { describe, it, expect, afterEach, vi } from "vitest";
import {
  civilDateInTimeZone,
  anchorCivilDate,
  anchorCalendarDate,
  todayInLocation,
  addAnchoredDays,
} from "@/lib/zmanim-day";
import { TORONTO_LOCATION, type ZmanimLocation } from "@/lib/zmanim-location";

const JERUSALEM_LOCATION: ZmanimLocation = {
  lat: 31.7683,
  lon: 35.2137,
  tzid: "Asia/Jerusalem",
  label: "Jerusalem, Israel",
  isIsrael: true,
};

/**
 * 2026-07-25T00:30:00Z is:
 *   - Friday 2026-07-24, 8:30 PM in Toronto (UTC-4, EDT)
 *   - Saturday 2026-07-25, 3:30 AM in Jerusalem (UTC+3, IDT)
 * One instant, two civil days. This is the bug in a single fixture.
 */
const FRIDAY_EVENING_ET = new Date("2026-07-25T00:30:00Z");

describe("civilDateInTimeZone", () => {
  it("returns the previous day for a Toronto evening instant past midnight UTC", () => {
    expect(civilDateInTimeZone(FRIDAY_EVENING_ET, "America/Toronto")).toEqual({
      year: 2026,
      month: 7,
      day: 24,
    });
  });

  it("returns the next day for the same instant in Jerusalem", () => {
    expect(civilDateInTimeZone(FRIDAY_EVENING_ET, "Asia/Jerusalem")).toEqual({
      year: 2026,
      month: 7,
      day: 25,
    });
  });

  it("reads UTC itself without shifting", () => {
    expect(civilDateInTimeZone(new Date("2026-08-01T12:00:00Z"), "UTC")).toEqual({
      year: 2026,
      month: 8,
      day: 1,
    });
  });

  it("handles a year boundary", () => {
    // 2027-01-01T02:00Z is still 2026-12-31 in Toronto.
    expect(civilDateInTimeZone(new Date("2027-01-01T02:00:00Z"), "America/Toronto")).toEqual({
      year: 2026,
      month: 12,
      day: 31,
    });
  });
});

describe("anchorCivilDate", () => {
  it("anchors at exactly 12:00:00.000 UTC", () => {
    const anchored = anchorCivilDate({ year: 2026, month: 7, day: 24 });
    expect(anchored.toISOString()).toBe("2026-07-24T12:00:00.000Z");
  });

  it("round-trips through civilDateInTimeZone in UTC", () => {
    const civil = { year: 2026, month: 11, day: 1 };
    expect(civilDateInTimeZone(anchorCivilDate(civil), "UTC")).toEqual(civil);
  });

  it("is read as the FOLLOWING day at UTC+12 — the documented limitation", () => {
    // Pacific/Auckland is UTC+12 (NZST) in July. Noon UTC is already midnight
    // the next day there, which is why the safe server interval is [-12, +12).
    const anchored = anchorCivilDate({ year: 2026, month: 7, day: 24 });
    expect(civilDateInTimeZone(anchored, "Pacific/Auckland")).toEqual({
      year: 2026,
      month: 7,
      day: 25,
    });
  });
});

describe("anchorCalendarDate", () => {
  it("preserves the calendar day of a Date built from local components", () => {
    const picked = new Date(2026, 7, 1); // 1 Aug 2026, local midnight
    expect(civilDateInTimeZone(anchorCalendarDate(picked), "UTC")).toEqual({
      year: 2026,
      month: 8,
      day: 1,
    });
  });

  it("preserves the calendar day of a noon-UTC instant (existing test-fixture form)", () => {
    const fixture = new Date("2026-07-14T12:00:00Z");
    expect(anchorCalendarDate(fixture).toISOString()).toBe("2026-07-14T12:00:00.000Z");
  });
});

describe("todayInLocation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves a Toronto evening instant to that evening's civil day", () => {
    expect(todayInLocation(TORONTO_LOCATION, FRIDAY_EVENING_ET).toISOString()).toBe(
      "2026-07-24T12:00:00.000Z"
    );
  });

  it("resolves the same instant to the next day for Jerusalem", () => {
    expect(todayInLocation(JERUSALEM_LOCATION, FRIDAY_EVENING_ET).toISOString()).toBe(
      "2026-07-25T12:00:00.000Z"
    );
  });

  it("falls back to the system clock when no instant is supplied", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FRIDAY_EVENING_ET);
    expect(todayInLocation(TORONTO_LOCATION).toISOString()).toBe("2026-07-24T12:00:00.000Z");
  });
});

describe("addAnchoredDays", () => {
  it("holds every anchor at exactly 12:00:00.000Z across the DST-end week", () => {
    // 2026-11-01 is when US/Canada DST ends. A setDate-based implementation
    // preserves local wall time and drifts the instant to 13:00Z partway
    // through this week; civil-date arithmetic must not.
    const base = anchorCivilDate({ year: 2026, month: 10, day: 30 });
    const week = Array.from({ length: 7 }, (_, i) => addAnchoredDays(base, i));

    for (const day of week) {
      expect(day.toISOString().slice(11)).toBe("12:00:00.000Z");
    }
  });

  it("holds every anchor at exactly 12:00:00.000Z across the DST-start week", () => {
    // 2026-03-08 is when US/Canada DST starts.
    const base = anchorCivilDate({ year: 2026, month: 3, day: 6 });
    const week = Array.from({ length: 7 }, (_, i) => addAnchoredDays(base, i));

    for (const day of week) {
      expect(day.toISOString().slice(11)).toBe("12:00:00.000Z");
    }
  });

  it("produces seven distinct consecutive civil days across a DST transition", () => {
    const base = anchorCivilDate({ year: 2026, month: 10, day: 30 });
    const days = Array.from({ length: 7 }, (_, i) =>
      addAnchoredDays(base, i).toISOString().slice(0, 10)
    );

    expect(days).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
    ]);
  });

  it("crosses a month boundary correctly", () => {
    const base = anchorCivilDate({ year: 2026, month: 7, day: 30 });
    expect(addAnchoredDays(base, 3).toISOString()).toBe("2026-08-02T12:00:00.000Z");
  });
});
