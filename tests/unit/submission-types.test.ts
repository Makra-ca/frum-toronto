import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { SUBMISSION_TYPES } from "@/lib/submissions/types";

// These assertions are deliberately checked against the REAL Drizzle columns
// rather than restated as literals. A hand-written expectation compared to a
// hand-written config in the same commit only regresses if someone edits both,
// and it covers whichever types the author remembered.

describe("SUBMISSION_TYPES", () => {
  const entries = Object.entries(SUBMISSION_TYPES);

  it.each(entries)("%s: every declared column exists on its table", (name, cfg) => {
    const columns = getTableColumns(cfg.table);
    for (const key of [
      cfg.ownerColumn,
      cfg.titleColumn,
      cfg.detailColumn,
      ...(cfg.shulColumn ? [cfg.shulColumn] : []),
      ...(cfg.pastBasis ? [cfg.pastBasis] : []),
      ...(cfg.pastExemptField ? [cfg.pastExemptField] : []),
    ]) {
      expect(columns[key], `${name}.${key} does not exist`).toBeDefined();
    }
  });

  it.each(entries)(
    "%s: detailKind matches the real column type, so dates cannot render a day early",
    (name, cfg) => {
      const column = getTableColumns(cfg.table)[cfg.detailColumn] as unknown as {
        columnType: string;
      };
      // Drizzle reports a `date()` column as PgDate or PgDateString depending
      // on its mode; both are calendar dates and must not be timezone-converted.
      const expected = column.columnType.startsWith("PgDate") ? "date" : "instant";
      expect(
        cfg.detailKind,
        `${name}.${cfg.detailColumn} is ${column.columnType}`
      ).toBe(expected);
    }
  );

  it.each(entries)("%s: every row carries approval and broadcast state", (name, cfg) => {
    const columns = getTableColumns(cfg.table);
    for (const key of ["approvalStatus", "broadcastAt", "rejectionReason", "updatedAt"]) {
      expect(columns[key], `${name}.${key} missing`).toBeDefined();
    }
  });

  it("only events is shul-linked — institutional ownership applies nowhere else yet", () => {
    const linked = entries.filter(([, c]) => c.shulColumn).map(([n]) => n);
    expect(linked).toEqual(["event"]);
  });

  it("records which types announce to subscribers, so 'none' is a decision not an omission", () => {
    const announcing = entries.filter(([, c]) => c.broadcast).map(([n]) => n);
    // kosherAlert also announces, but via an inline resend.batch in its admin
    // route rather than a shared helper — it is wired there until that route
    // moves onto setApprovalStatus.
    expect(announcing.sort()).toEqual(["event", "shiva"]);
  });

  it("excludes types with no owner or no submission path", () => {
    // shiurim has no owner column; specials has no public submission API;
    // published ask_the_rabbi rows are answered, not approved.
    const names = entries.map(([n]) => n);
    expect(names).not.toContain("shiur");
    expect(names).not.toContain("special");
    expect(names).not.toContain("askTheRabbi");
    expect(names).toHaveLength(8);
  });
});
