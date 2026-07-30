import { describe, it, expect } from "vitest";
import { formatInstant, formatDateOnly } from "@/lib/datetime";

// These tests run with TZ=UTC (see vitest.config.mts), which is exactly what
// Vercel runs. That is the whole point: on an America/Toronto laptop the
// production bug does not reproduce, because the process timezone happens to
// be the right answer. Pinned to UTC, an unconverted value fails loudly.

describe("formatInstant", () => {
  it("renders a UTC instant in Toronto time during EST (winter)", () => {
    // Real production row: events.id 43, "Bais Yaakov HS Play".
    // Stored 2027-01-27 00:30 UTC. The play is at 7:30 PM on Jan 26 in Toronto.
    // The live detail page renders "Wednesday, January 27, 2027, 12:30 AM".
    const result = formatInstant("2027-01-27T00:30:00.000Z", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    expect(result).toBe("Tuesday, January 26, 2027 at 7:30 PM");
  });

  it("renders a UTC instant in Toronto time during EDT (summer)", () => {
    // Real production row: events.id 45. Stored 2027-06-22 23:30 UTC.
    // Toronto is UTC-4 in June, so this is 7:30 PM on Jun 22 — same day.
    const result = formatInstant("2027-06-22T23:30:00.000Z", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    expect(result).toBe("June 22, 2027 at 7:30 PM");
  });

  it("accepts a Date object as well as an ISO string", () => {
    const asDate = formatInstant(new Date("2027-01-27T00:30:00.000Z"), {
      month: "short",
      day: "numeric",
    });
    const asString = formatInstant("2027-01-27T00:30:00.000Z", {
      month: "short",
      day: "numeric",
    });

    expect(asDate).toBe("Jan 26");
    expect(asDate).toBe(asString);
  });

  it("returns an empty string for null or undefined rather than 'Invalid Date'", () => {
    expect(formatInstant(null)).toBe("");
    expect(formatInstant(undefined)).toBe("");
  });

  it("returns an empty string for an unparseable value", () => {
    expect(formatInstant("not a date")).toBe("");
  });
});

describe("formatDateOnly", () => {
  it("does not shift a date-only string backwards", () => {
    // simchas.event_date / kosher_alerts.effective_date are DATE columns.
    // `new Date("2027-06-22")` is midnight UTC, which in Toronto is the 21st at
    // 8pm. Converting these to Toronto is the bug, not the fix.
    expect(formatDateOnly("2027-06-22")).toBe("June 22, 2027");
  });

  it("does not shift a date that arrives as a midnight-UTC timestamp", () => {
    // The kosher-alerts API serialises legacy DATE values as T00:00:00.000Z.
    expect(formatDateOnly("2026-04-01T00:00:00.000Z")).toBe("April 1, 2026");
  });

  it("honours format options", () => {
    expect(
      formatDateOnly("2027-06-22", { month: "short", day: "numeric" })
    ).toBe("Jun 22");
  });

  it("returns an empty string for null or undefined", () => {
    expect(formatDateOnly(null)).toBe("");
    expect(formatDateOnly(undefined)).toBe("");
  });

  it("returns an empty string for an unparseable value", () => {
    expect(formatDateOnly("nonsense")).toBe("");
  });
});
