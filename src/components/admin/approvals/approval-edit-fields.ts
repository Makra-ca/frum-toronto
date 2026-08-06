/**
 * Which fields the Approvals queue lets you correct, per type.
 *
 * ## Why a separate, smaller editor
 *
 * Each type already has a full editor on its own admin page — but those are
 * inline dialogs inside 600–800 line page files, not reusable components, and
 * extracting three of them would be a large refactor of pages that work.
 *
 * More to the point, the job is different. In the queue you are fixing a typo
 * or a wrong time before saying yes; you are not restructuring the record. The
 * full editor stays one click away for anything larger.
 *
 * ## Fields were chosen against the PATCH schemas, not guessed
 *
 * Every field below is accepted by that type's `PATCH /api/admin/<type>/[id]`.
 * This matters: those schemas are `z.object`, which **silently strips** unknown
 * keys — so a mistyped field name here would produce a save that reports
 * success and changes nothing. That exact bug has already happened twice in
 * this codebase (the admin blog Reject button, and `approvalStatus` on the
 * shared update path).
 *
 * Plain data, no React, so it can be checked by a test that needs no DOM.
 */

export type FieldKind = "text" | "textarea" | "datetime" | "date" | "number";

export interface EditableField {
  /** Must match the PATCH schema key exactly — see the note above. */
  name: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
}

export type ApprovalType = "simchas" | "events" | "classifieds" | "tehillim";

/**
 * Extra keys that must ride along even though they are not editable here.
 *
 * Only one, and only because `events` PATCH validates with
 * `eventSchema.parse()`, which is NOT partial: `title`, `startTime` and
 * `isAllDay` are mandatory. The first two are editable fields; `isAllDay` is
 * not, so it is copied from the fetched row.
 *
 * Nothing else is sent, and nothing else needs to be. Untouched columns survive
 * because Drizzle skips `undefined` in `.set()` — measured, not assumed.
 *
 * Four event fields used to be an exception: `contactEmail` and the three URL
 * columns were written as `value || null`, so omitting one deleted it. They
 * were carried here as a workaround until the real fix landed in
 * `handleUpdate`, which now distinguishes "" (clear it) from absent (leave it).
 * The workaround is gone because the cause is.
 */
export const ALWAYS_SEND: Partial<Record<ApprovalType, string[]>> = {
  events: ["isAllDay"],
};

/**
 * The API path segment for each tab. Identical to the tab key today, and named
 * separately anyway so a future rename of one cannot silently point the editor
 * at the wrong endpoint.
 */
export const EDIT_ENDPOINT: Record<ApprovalType, string> = {
  simchas: "simchas",
  events: "events",
  classifieds: "classifieds",
  tehillim: "tehillim",
};

export const EDITABLE_FIELDS: Record<ApprovalType, EditableField[]> = {
  events: [
    { name: "title", label: "Title", kind: "text" },
    // The single most likely thing to be wrong on a submitted event, and the
    // reason this editor exists at all.
    { name: "startTime", label: "Starts", kind: "datetime" },
    { name: "endTime", label: "Ends", kind: "datetime" },
    { name: "location", label: "Location", kind: "text" },
    { name: "organization", label: "Organisation", kind: "text" },
    { name: "description", label: "Description", kind: "textarea" },
  ],
  simchas: [
    { name: "familyName", label: "Family name", kind: "text" },
    { name: "announcement", label: "Announcement", kind: "textarea" },
    // A DATE column, not an instant — see formatDateOnly. Treating it as a
    // datetime would shift it by the timezone offset and land it a day early.
    { name: "eventDate", label: "Date of the simcha", kind: "date" },
    { name: "location", label: "Location", kind: "text" },
  ],
  classifieds: [
    { name: "title", label: "Title", kind: "text" },
    { name: "description", label: "Description", kind: "textarea" },
    /*
      NUMBER, not text. The Zod schema says `price: z.string()`, which reads as
      free text — but the column is `numeric(·,2)`, so Postgres rejects anything
      non-numeric with a 500. Verified: PATCHing "Best offer" returns
      `invalid input syntax for type numeric`.

      "Negotiable" and "Free" are expressed by `priceType`, not by typing words
      into this field. That is not offered here; the type's own editor has it.
    */
    { name: "price", label: "Price", kind: "number", placeholder: "e.g. 50" },
    { name: "location", label: "Location", kind: "text" },
    { name: "contactName", label: "Contact name", kind: "text" },
    { name: "contactPhone", label: "Contact phone", kind: "text" },
  ],
  tehillim: [
    { name: "hebrewName", label: "Hebrew name", kind: "text" },
    { name: "englishName", label: "English name", kind: "text" },
    { name: "motherHebrewName", label: "Mother's Hebrew name", kind: "text" },
    { name: "reason", label: "Reason", kind: "text" },
  ],
};

/** Singular, for dialog copy. "simchas" → "simcha". */
export function singular(type: ApprovalType): string {
  return type === "classifieds" ? "classified" : type.replace(/s$/, "");
}
