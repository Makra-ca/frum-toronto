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
    // Every label has to be prose. Comparing each to its own key catches a
    // future status styled as `foo: { label: "foo" }`, which the old version
    // of this test — `not.toContain("pending_edit")` — could not.
    for (const [status, style] of Object.entries(STATUS_STYLES)) {
      expect(style.label, `${status} shows its raw status`).not.toBe(status);
      expect(style.label.length, `${status} has no label`).toBeGreaterThan(0);
    }
    expect(STATUS_STYLES.pending_edit.label).toBe("Awaiting re-approval");
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

  it("renders the SAME stored value differently by kind", () => {
    // The discriminator has to change the output, or it is decoration. A
    // midnight-UTC value is the case that separates them: as a date it is the
    // 1st, as an instant it is the previous evening in Toronto.
    const asDate = formatSubmissionDetail("2027-01-01", "date");
    const asInstant = formatSubmissionDetail("2027-01-01T00:00:00.000Z", "instant");

    expect(asDate).toContain("Jan 1, 2027");
    expect(asInstant).toContain("Dec 31, 2026");
    expect(asDate).not.toBe(asInstant);
  });
});
