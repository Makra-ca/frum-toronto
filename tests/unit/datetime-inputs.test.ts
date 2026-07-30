import { describe, it, expect } from "vitest";
import {
  toDateInputValue,
  toTimeInputValue,
  fromDateTimeInputs,
} from "@/lib/datetime";

// Regression tests for the admin event form.
//
// `EventForm.tsx` read the two halves of a datetime in DIFFERENT timezones:
// `formatDateForInput` used toISOString() (UTC) while `formatTimeForInput`
// used toTimeString() (process-local). For any evening event those disagree,
// and saving wrote the mismatch back — pushing the event one day later on
// EVERY save:
//
//   stored: 2026-09-03 00:45Z
//   form shows 2026-09-03 20:45 -> save -> 2026-09-04 00:45Z
//   form shows 2026-09-04 20:45 -> save -> 2026-09-05 00:45Z
//
// Both halves must come from the same timezone, and that timezone is Toronto.

describe("admin form date/time inputs", () => {
  it("reads both halves of an instant from the same (Toronto) timezone", () => {
    // 2026-09-03T00:45Z is Sept 2, 8:45 PM in Toronto — an evening reception.
    const stored = "2026-09-03T00:45:00.000Z";

    expect(toDateInputValue(stored)).toBe("2026-09-02");
    expect(toTimeInputValue(stored)).toBe("20:45");
  });

  it("round-trips an evening instant without moving it (the corruption bug)", () => {
    const stored = "2026-09-03T00:45:00.000Z";

    let current = stored;
    for (let save = 0; save < 3; save++) {
      current = fromDateTimeInputs(
        toDateInputValue(current),
        toTimeInputValue(current)
      );
    }

    expect(current).toBe(stored);
  });

  it("round-trips across the EST/EDT boundary", () => {
    const winter = "2027-01-27T00:30:00.000Z"; // Jan 26, 7:30 PM EST
    const summer = "2027-06-22T23:30:00.000Z"; // Jun 22, 7:30 PM EDT

    expect(toTimeInputValue(winter)).toBe("19:30");
    expect(toTimeInputValue(summer)).toBe("19:30");

    expect(
      fromDateTimeInputs(toDateInputValue(winter), toTimeInputValue(winter))
    ).toBe(winter);
    expect(
      fromDateTimeInputs(toDateInputValue(summer), toTimeInputValue(summer))
    ).toBe(summer);
  });

  it("interprets typed input as Toronto time, not as the running timezone", () => {
    // This test runs with TZ=UTC. The old form did `new Date(y, m-1, d, h, m)`,
    // which would read 7:30 PM as 7:30 PM UTC and produce ...T19:30:00Z.
    // Toronto in June is UTC-4, so the correct instant is 23:30Z.
    expect(fromDateTimeInputs("2027-06-22", "19:30")).toBe(
      "2027-06-22T23:30:00.000Z"
    );
  });

  it("round-trips across both DST transition days", () => {
    // Spring forward 2027-03-14, fall back 2027-11-07. An evening event on
    // either day must still come back as the same instant.
    for (const iso of ["2027-03-14T23:00:00.000Z", "2027-11-08T00:00:00.000Z"]) {
      expect(
        fromDateTimeInputs(toDateInputValue(iso), toTimeInputValue(iso))
      ).toBe(iso);
    }
  });

  it("returns empty strings for a missing value", () => {
    expect(toDateInputValue(null)).toBe("");
    expect(toTimeInputValue(null)).toBe("");
  });
});
