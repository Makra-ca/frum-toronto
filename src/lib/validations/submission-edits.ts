import { z } from "zod";
import { MODERATION_VALUES } from "@/lib/comments/moderation";
import type { SubmissionType } from "@/lib/submissions/types";
import { isUploadedImageUrl } from "@/lib/safe-url";

/**
 * What a submitter may send when editing, per type.
 *
 * `applyEdit` whitelists the fields it will write regardless, so this layer is
 * about shape: lengths that match the column, a number where the column is an
 * integer, a real date string where the column is a DATE.
 *
 * Lengths are taken from src/lib/db/schema.ts. Sending more than the column
 * holds is a 500 from Postgres rather than a 400 the user can act on.
 *
 * Note every field is optional: an edit form may legitimately send only what
 * changed, and applyEdit rejects a request that carries nothing editable.
 */

const optionalText = (max: number) =>
  z.string().max(max).optional().nullable().or(z.literal(""));

/**
 * A DATE column: a calendar day, never an instant.
 *
 * Note there is no `.or(z.literal(""))`. An empty string reaches Postgres as
 * `invalid input syntax for type date` — a 500 with no useful message — where
 * `null` is what "cleared" actually means. The form already sends null; this
 * makes a hand-crafted request behave too.
 */
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date in YYYY-MM-DD form")
  .optional()
  .nullable();

/** Same, for a column the database declares NOT NULL. */
const requiredDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date in YYYY-MM-DD form")
  .optional();

export const classifiedEditSchema = z.object({
  categoryId: z.number().int().positive().optional().nullable(),
  title: z.string().min(1, "Title is required").max(255).optional(),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000, "Description must be under 2000 characters")
    .optional(),
  // decimal(10,2). Free text here means "50 or best offer" reaches Postgres as
  // `invalid input syntax for type numeric` — a 500 rather than a message the
  // seller can act on. Eight digits before the point is the column's limit.
  price: z
    .string()
    .regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter a number, e.g. 50 or 49.99")
    .optional()
    .nullable()
    .or(z.literal("")),
  priceType: optionalText(20),
  contactName: optionalText(100),
  contactEmail: z.string().email().max(255).optional().nullable().or(z.literal("")),
  contactPhone: optionalText(40),
  location: optionalText(200),
  imageUrl: optionalText(500),
});

export const simchaEditSchema = z.object({
  typeId: z.number().int().positive().optional().nullable(),
  familyName: z.string().min(1, "Family name is required").max(200).optional(),
  announcement: z
    .string()
    .min(10, "Announcement must be at least 10 characters")
    .optional(),
  eventDate: dateOnly,
  location: optionalText(200),
  photoUrl: optionalText(500),
});

export const kosherAlertEditSchema = z.object({
  productName: z.string().min(1, "Product name is required").max(200).optional(),
  brand: optionalText(200),
  alertType: z
    .enum(["recall", "status_change", "warning", "update"])
    .optional()
    .nullable(),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .optional(),
  certifyingAgency: optionalText(200),
  effectiveDate: dateOnly,
  issueDate: dateOnly,
});

export const alertEditSchema = z.object({
  // `kosher` is a real value in this column (see schema.ts) even though the
  // create form never offers it. Omitting it here made such a row unsaveable:
  // the select rendered blank and every save failed validation.
  alertType: z
    .enum(["general", "bulletin", "announcement", "warning", "kosher"])
    .optional(),
  title: z.string().min(1, "Title is required").max(200).optional(),
  content: z
    .string()
    .min(10, "Details must be at least 10 characters")
    .optional(),
  urgency: z.enum(["normal", "high", "urgent"]).optional(),
});

export const tehillimEditSchema = z.object({
  hebrewName: optionalText(200),
  englishName: optionalText(200),
  motherHebrewName: optionalText(200),
  reason: optionalText(200),
});

export const shivaEditSchema = z.object({
  niftarName: z.string().min(1, "Name is required").max(200).optional(),
  niftarNameHebrew: optionalText(200),
  mournerNames: z.array(z.string().max(200)).optional(),
  shivaAddress: optionalText(500),
  // NOT NULL columns. Nullable here means clearing the field in the form is a
  // Postgres 23502 and a generic 500; the create path rejects it with a 400.
  shivaStart: requiredDate,
  shivaEnd: requiredDate,
  shivaHours: optionalText(200),
  daveningTimes: z.string().optional().nullable(),
  levayaInfo: z.string().optional().nullable(),
  zoomInfo: z.string().optional().nullable(),
  minyanInfo: z.string().optional().nullable(),
  // The create path writes this only when isUploadedImageUrl() passes, so it
  // is always our own Blob host. Without the same check here, an approved
  // notice could be edited to point the "official attachment" at any URL —
  // and for an auto-approver that change stays live with no review.
  attachmentUrl: z
    .string()
    .max(500)
    .refine((url) => !url || isUploadedImageUrl(url), {
      message: "Attachments must be uploaded through this form",
    })
    .optional()
    .nullable()
    .or(z.literal("")),
  mealInfo: z.string().optional().nullable(),
  donationInfo: z.string().optional().nullable(),
  contactPhone: optionalText(40),
});

export const blogEditSchema = z.object({
  title: z.string().min(1, "Title is required").max(300).optional(),
  content: z.string().min(1, "Content is required").optional(),
  contentJson: z.any().optional().nullable(),
  coverImageUrl: optionalText(500),
  excerpt: optionalText(500),
  categoryId: z.number().int().positive().optional().nullable(),
  customCategory: optionalText(100),
  // The route checks the DIRECTION (canSetModerationOverride) — an author may
  // only make their own post stricter. The enum here just rejects values the
  // comment route would not recognise; note the admin editor used to send
  // "require_approval", which this would refuse.
  commentModeration: z.enum(MODERATION_VALUES).optional().nullable(),
});

/** Events keep publicEventSchema, which the create path already uses. */
export const SUBMISSION_EDIT_SCHEMAS: Record<
  Exclude<SubmissionType, "event">,
  z.ZodTypeAny
> = {
  classified: classifiedEditSchema,
  simcha: simchaEditSchema,
  kosherAlert: kosherAlertEditSchema,
  alert: alertEditSchema,
  tehillim: tehillimEditSchema,
  shiva: shivaEditSchema,
  blog: blogEditSchema,
};
