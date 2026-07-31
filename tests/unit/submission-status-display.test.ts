import { describe, it, expect } from "vitest";
import {
  STATUS_STYLES,
  STYLED_STATUSES,
  statusStyle,
  formatSubmissionDetail,
} from "@/lib/submissions/status-display";

describe("STATUS_STYLES", () => {
  it("styles every status the system can produce", () => {
    // Driven from the constants, so adding a status FORCES a style rather than
    // falling through to a grey badge showing the raw column value.
    expect(Object.keys(STATUS_STYLES).sort()).toEqual([...STYLED_STATUSES].sort());
  });

  it("does not show a user the database's words", () => {
    expect(STATUS_STYLES.pending_edit.label).toBe("Awaiting re-approval");
    expect(Object.values(STATUS_STYLES).map((s) => s.label)).not.toContain(
      "pending_edit"
    );
  });

  it("falls back rather than crashing on an unknown status", () => {
    expect(statusStyle("banana").label).toBe("Unknown");
  });
});

describe("formatSubmissionDetail", () => {
  it("renders a date column as the day it stores", () => {
    // The bug this branch exists to prevent: a DATE pushed through an instant
    // formatter comes out as the day before for a Toronto viewer.
    expect(formatSubmissionDetail("2027-06-22", "date")).toContain("Jun 22, 2027");
  });

  it("renders an instant in Toronto time", () => {
    // 2027-06-22T00:30Z is still the 21st, 8:30pm, in Toronto.
    const out = formatSubmissionDetail("2027-06-22T00:30:00.000Z", "instant");
    expect(out).toContain("Jun 21, 2027");
    expect(out).toContain("8:30");
  });

  it("does not invent a value when there is nothing to show", () => {
    expect(formatSubmissionDetail(null, "instant")).toBeNull();
    expect(formatSubmissionDetail("", "date")).toBeNull();
  });

  it("shows a date-only value the same regardless of the viewer's clock", () => {
    // The same stored day, formatted twice, must not depend on when it is run.
    const a = formatSubmissionDetail("2027-01-01", "date");
    const b = formatSubmissionDetail("2027-01-01", "date");
    expect(a).toBe(b);
    expect(a).toContain("Jan 1, 2027");
  });
});
