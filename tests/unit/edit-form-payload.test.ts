import { describe, it, expect } from "vitest";
import { EDIT_FORMS } from "@/lib/submissions/edit-form-fields";
import { SUBMISSION_EDIT_SCHEMAS } from "@/lib/validations/submission-edits";
import type { SubmissionType } from "@/lib/submissions/types";

/**
 * The form's real payload, through the real schema.
 *
 * Nothing joined these two before, and that is exactly how two defects
 * shipped: clearing a shiva date sent null into a NOT NULL column (a 500), and
 * a blank alert select sent null where the enum required a string (a 400 whose
 * message was raw Zod). Both were invisible because the form was tested
 * against a mock and the schema was tested against hand-written bodies.
 *
 * Builds the payload the way handleSubmit does — every field in the spec,
 * empties as null — and asserts the schema accepts it.
 */

/** Mirrors SubmissionEditForm.handleSubmit. */
function payloadFor(
  type: keyof typeof EDIT_FORMS,
  values: Record<string, string | string[]>
) {
  const payload: Record<string, unknown> = {};
  for (const field of EDIT_FORMS[type].fields) {
    const value = values[field.name];
    if (Array.isArray(value)) {
      payload[field.name] = value.filter((v) => v.trim());
    } else if (field.kind === "lookup") {
      payload[field.name] = value?.trim() ? Number(value) : null;
    } else {
      payload[field.name] = value?.trim() ? value.trim() : null;
    }
  }
  return payload;
}

/** A plausible value for each field kind, so "filled in" means filled in. */
function filled(type: keyof typeof EDIT_FORMS) {
  const values: Record<string, string | string[]> = {};
  for (const field of EDIT_FORMS[type].fields) {
    switch (field.kind) {
      case "date":
        values[field.name] = "2027-06-22";
        break;
      case "select":
        values[field.name] = field.options?.[0]?.value ?? "";
        break;
      case "stringList":
        values[field.name] = ["Someone"];
        break;
      case "email":
        values[field.name] = "someone@example.com";
        break;
      case "lookup":
        // An id, as the select holds it — the payload builder converts it.
        values[field.name] = "1";
        break;
      default:
        // Long enough for the min(10) rules the create paths enforce.
        values[field.name] = "A reasonable value for this field";
    }
  }
  // Two fields have formats the generic filler cannot guess.
  if (type === "classified") values.price = "49.99";
  if (type === "shiva")
    values.attachmentUrl = "https://xyz.public.blob.vercel-storage.com/a.pdf";
  return values;
}

const types = Object.keys(EDIT_FORMS) as (keyof typeof EDIT_FORMS)[];

describe.each(types)("%s edit form payload", (type) => {
  const schema = SUBMISSION_EDIT_SCHEMAS[type as Exclude<SubmissionType, "event">];

  it("is accepted when every field is filled in", () => {
    const result = schema.safeParse(payloadFor(type, filled(type)));
    expect(
      result.success ? null : result.error.issues.map((i) => `${i.path}: ${i.message}`)
    ).toBeNull();
  });

  it("is accepted when every OPTIONAL field is cleared", () => {
    // The user empties everything they are allowed to empty. A required field
    // keeps its value, because the browser will not submit the form without it.
    const values = filled(type);
    for (const field of EDIT_FORMS[type].fields) {
      if (!field.required) values[field.name] = field.kind === "stringList" ? [] : "";
    }

    const result = schema.safeParse(payloadFor(type, values));
    expect(
      result.success ? null : result.error.issues.map((i) => `${i.path}: ${i.message}`)
    ).toBeNull();
  });

  it("offers no select whose blank option the schema rejects", () => {
    // A select that renders "—" must accept null, or choosing it is a 400 the
    // user cannot act on.
    for (const field of EDIT_FORMS[type].fields) {
      if ((field.kind !== "select" && field.kind !== "lookup") || field.noBlank)
        continue;

      const values = filled(type);
      values[field.name] = "";
      const result = schema.safeParse(payloadFor(type, values));

      expect(
        result.success
          ? null
          : `${field.name}: ${result.error.issues.map((i) => i.message).join(", ")}`
      ).toBeNull();
    }
  });

  it("marks a field required whenever the schema demands a value", () => {
    // Derived, not restated: clear one field at a time and see whether the
    // schema objects. If it does, the form must be asking for it.
    for (const field of EDIT_FORMS[type].fields) {
      if (field.required) continue;

      const values = filled(type);
      values[field.name] = field.kind === "stringList" ? [] : "";
      const result = schema.safeParse(payloadFor(type, values));

      expect(
        result.success ? null : `${field.name} is optional in the form but ${
          result.error.issues.map((i) => i.message).join(", ")
        }`
      ).toBeNull();
    }
  });
});
