import type { SubmissionType } from "@/lib/submissions/types";

/**
 * The edit form, described rather than hand-built per type.
 *
 * Six bespoke pages would each be a place for the unpublish warning to be
 * forgotten, for a date input to be wired to an instant, or for a field that
 * `applyEdit` will refuse to write to be rendered anyway. A test asserts every
 * name here appears in EDITABLE_FIELDS, so the form cannot offer a control
 * that silently does nothing.
 */

export interface EditFieldSpec {
  name: string;
  label: string;
  kind: "text" | "textarea" | "date" | "select" | "stringList" | "email" | "tel";
  required?: boolean;
  options?: { value: string; label: string }[];
  help?: string;
  placeholder?: string;
}

export interface EditFormSpec {
  /** URL segment under /api/community and /dashboard/submissions. */
  folder: string;
  heading: string;
  fields: EditFieldSpec[];
  /**
   * Shown when the item is currently live. Shiva overrides the standard copy:
   * a notice disappearing mid-shiva is the sharpest form of the unpublish
   * trade-off, and the spec makes a stronger warning mandatory rather than
   * optional.
   */
  liveWarning?: string;
}

const STANDARD_LIVE_WARNING =
  "This is on the site now. Saving takes it down until an admin approves the change.";

export const EDIT_FORMS: Record<
  Exclude<SubmissionType, "event" | "blog">,
  EditFormSpec
> = {
  classified: {
    folder: "classifieds",
    heading: "Edit your listing",
    fields: [
      { name: "title", label: "Title", kind: "text", required: true },
      { name: "description", label: "Description", kind: "textarea", required: true },
      { name: "price", label: "Price", kind: "text", placeholder: "e.g. 50.00" },
      {
        name: "priceType",
        label: "Price type",
        kind: "select",
        options: [
          { value: "fixed", label: "Fixed" },
          { value: "negotiable", label: "Negotiable" },
          { value: "free", label: "Free" },
        ],
      },
      { name: "location", label: "Location", kind: "text" },
      { name: "contactName", label: "Contact name", kind: "text" },
      { name: "contactEmail", label: "Contact email", kind: "email" },
      { name: "contactPhone", label: "Contact phone", kind: "tel" },
      { name: "imageUrl", label: "Image URL", kind: "text" },
    ],
  },
  simcha: {
    folder: "simchas",
    heading: "Edit your simcha announcement",
    fields: [
      { name: "familyName", label: "Family name", kind: "text", required: true },
      {
        name: "announcement",
        label: "Announcement",
        kind: "textarea",
        required: true,
        help: "At least 10 characters.",
      },
      {
        name: "eventDate",
        label: "Date",
        kind: "date",
        help: "The day itself — this is not converted to a time zone.",
      },
      { name: "location", label: "Location", kind: "text" },
      { name: "photoUrl", label: "Photo URL", kind: "text" },
    ],
  },
  kosherAlert: {
    folder: "kosher-alerts",
    heading: "Edit your kosher alert",
    fields: [
      { name: "productName", label: "Product", kind: "text", required: true },
      { name: "brand", label: "Brand", kind: "text" },
      {
        name: "alertType",
        label: "Alert type",
        kind: "select",
        options: [
          { value: "recall", label: "Recall" },
          { value: "status_change", label: "Status change" },
          { value: "warning", label: "Warning" },
          { value: "update", label: "Update" },
        ],
      },
      { name: "description", label: "Details", kind: "textarea", required: true },
      { name: "certifyingAgency", label: "Certifying agency", kind: "text" },
      { name: "effectiveDate", label: "Effective date", kind: "date" },
      { name: "issueDate", label: "Issue date", kind: "date" },
    ],
  },
  alert: {
    folder: "alerts",
    heading: "Edit your alert",
    fields: [
      { name: "title", label: "Title", kind: "text", required: true },
      { name: "content", label: "Details", kind: "textarea", required: true },
      {
        name: "alertType",
        label: "Type",
        kind: "select",
        options: [
          { value: "general", label: "General" },
          { value: "bulletin", label: "Bulletin" },
          { value: "announcement", label: "Announcement" },
          { value: "warning", label: "Warning" },
        ],
      },
      {
        name: "urgency",
        label: "Urgency",
        kind: "select",
        options: [
          { value: "normal", label: "Normal" },
          { value: "high", label: "High" },
          { value: "urgent", label: "Urgent" },
        ],
      },
    ],
  },
  tehillim: {
    folder: "tehillim",
    heading: "Edit this tehillim entry",
    fields: [
      { name: "hebrewName", label: "Hebrew name", kind: "text" },
      { name: "englishName", label: "English name", kind: "text" },
      { name: "motherHebrewName", label: "Mother's Hebrew name", kind: "text" },
      { name: "reason", label: "Reason", kind: "text" },
    ],
  },
  shiva: {
    folder: "shiva",
    heading: "Edit this shiva notice",
    liveWarning:
      "This notice is on the site now. Saving takes it down until an admin approves the change — during a shiva, that may be the window when people are looking for it. If the change is not urgent, consider leaving it and contacting us instead.",
    fields: [
      { name: "niftarName", label: "Name", kind: "text", required: true },
      { name: "niftarNameHebrew", label: "Hebrew name", kind: "text" },
      { name: "mournerNames", label: "Mourners", kind: "stringList" },
      { name: "shivaAddress", label: "Address", kind: "textarea" },
      { name: "shivaStart", label: "Shiva starts", kind: "date" },
      { name: "shivaEnd", label: "Shiva ends", kind: "date" },
      { name: "shivaHours", label: "Hours", kind: "text" },
      { name: "daveningTimes", label: "Davening times", kind: "textarea" },
      { name: "levayaInfo", label: "Levaya", kind: "textarea" },
      { name: "minyanInfo", label: "Minyan", kind: "textarea" },
      { name: "zoomInfo", label: "Zoom", kind: "textarea" },
      { name: "mealInfo", label: "Meals", kind: "textarea" },
      { name: "donationInfo", label: "Donations", kind: "textarea" },
      { name: "contactPhone", label: "Contact phone", kind: "tel" },
      { name: "attachmentUrl", label: "Attachment URL", kind: "text" },
    ],
  },
};

export function liveWarningFor(spec: EditFormSpec): string {
  return spec.liveWarning ?? STANDARD_LIVE_WARNING;
}
