import { describe, it, expect } from "vitest";
import { EDIT_FORMS, liveWarningFor } from "@/lib/submissions/edit-form-fields";
import { EDITABLE_FIELDS } from "@/lib/submissions/editable-fields";
import { getTableColumns } from "drizzle-orm";
import { SUBMISSION_TYPES, type SubmissionType } from "@/lib/submissions/types";

describe("EDIT_FORMS", () => {
  it("never offers a control the API will refuse to write", () => {
    // applyEdit writes only what EDITABLE_FIELDS allows. A field rendered here
    // but missing there is a box the user types into, saves, and watches do
    // nothing — with no error anywhere.
    for (const [type, spec] of Object.entries(EDIT_FORMS)) {
      const allowed = EDITABLE_FIELDS[type as SubmissionType];
      for (const field of spec.fields) {
        expect(allowed, `${type}.${field.name} is not editable`).toContain(
          field.name
        );
      }
    }
  });

  it("points at the same URL the dashboard links to", () => {
    // editPath in the config and folder here are two halves of one route. If
    // they disagree the Edit button 404s.
    for (const [type, spec] of Object.entries(EDIT_FORMS)) {
      const href = SUBMISSION_TYPES[type as SubmissionType].editPath(123);
      expect(href, type).toBe(`/dashboard/submissions/${spec.folder}/123/edit`);
    }
  });

  it("binds every date column to a date control, and nothing else", () => {
    // Derived from the real Drizzle column types, so it covers whichever date
    // columns exist rather than the three the author happened to remember.
    // Rendering a DATE as free text invites a value the column cannot hold.
    for (const [type, spec] of Object.entries(EDIT_FORMS)) {
      const columns = getTableColumns(SUBMISSION_TYPES[type as SubmissionType].table);
      for (const field of spec.fields) {
        const column = columns[field.name] as unknown as { columnType: string };
        const isDateColumn = column.columnType.startsWith("PgDate");
        expect(
          field.kind === "date",
          `${type}.${field.name} is ${column.columnType} but rendered as ${field.kind}`
        ).toBe(isDateColumn);
      }
    }
  });

  it("gives shiva a stronger warning than the standard one", () => {
    // Mandatory per the spec, not optional: a notice disappearing mid-shiva is
    // the sharpest form of the unpublish trade-off.
    const shiva = liveWarningFor(EDIT_FORMS.shiva);
    const standard = liveWarningFor(EDIT_FORMS.classified);

    expect(shiva).not.toBe(standard);
    expect(shiva.length).toBeGreaterThan(standard.length);
    expect(shiva.toLowerCase()).toContain("shiva");
  });

  it("tells every type's user that saving takes the item down", () => {
    // A length check could not fail here — liveWarningFor falls back to an
    // 89-character default, so every type passes whatever it declares. Assert
    // the warning actually says what happens.
    for (const [type, spec] of Object.entries(EDIT_FORMS)) {
      const warning = liveWarningFor(spec).toLowerCase();
      expect(
        warning.includes("takes it down") || warning.includes("takes it down until") ||
          warning.includes("off the site") || warning.includes("approves the change"),
        `${type}: "${liveWarningFor(spec)}" does not say what saving does`
      ).toBe(true);
    }
  });

  it("covers every type that has an edit route", () => {
    // events and blog keep their own forms.
    expect(Object.keys(EDIT_FORMS).sort()).toEqual(
      ["alert", "classified", "kosherAlert", "shiva", "simcha", "tehillim"].sort()
    );
  });

  // "which fields must be required" is derived from the schema in
  // tests/unit/edit-form-payload.test.ts rather than restated as a literal
  // list here. A hardcoded list is written from the same assumption as the
  // code, so it agreed with two real defects: a cleared shiva date (a 500 from
  // a NOT NULL column) and a blank alert select (a 400 of raw Zod).
});
