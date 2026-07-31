import { describe, it, expect } from "vitest";
import { EDIT_FORMS, liveWarningFor } from "@/lib/submissions/edit-form-fields";
import { EDITABLE_FIELDS } from "@/lib/submissions/editable-fields";
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

  it("binds every date column to a date control", () => {
    // A date column rendered as a text input invites a free-form value; worse,
    // rendering it as datetime would drag a calendar day through a timezone.
    const dateFields = Object.values(EDIT_FORMS).flatMap((spec) =>
      spec.fields.filter((f) => f.kind === "date").map((f) => f.name)
    );
    expect(dateFields).toContain("eventDate");
    expect(dateFields).toContain("shivaStart");
    expect(dateFields).toContain("shivaEnd");
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

  it("warns on every type, so none can ship without one", () => {
    for (const [type, spec] of Object.entries(EDIT_FORMS)) {
      expect(liveWarningFor(spec).length, type).toBeGreaterThan(20);
    }
  });

  it("covers every type that has an edit route", () => {
    // events and blog keep their own forms.
    expect(Object.keys(EDIT_FORMS).sort()).toEqual(
      ["alert", "classified", "kosherAlert", "shiva", "simcha", "tehillim"].sort()
    );
  });

  it("marks the columns the database requires as required", () => {
    // A NOT NULL column left blank is a 500 from Postgres rather than a
    // message the user can act on.
    const required = (type: keyof typeof EDIT_FORMS) =>
      EDIT_FORMS[type].fields.filter((f) => f.required).map((f) => f.name);

    expect(required("classified")).toEqual(["title", "description"]);
    expect(required("simcha")).toEqual(["familyName", "announcement"]);
    expect(required("kosherAlert")).toEqual(["productName", "description"]);
    expect(required("alert")).toEqual(["title", "content"]);
    expect(required("shiva")).toEqual(["niftarName"]);
  });
});
