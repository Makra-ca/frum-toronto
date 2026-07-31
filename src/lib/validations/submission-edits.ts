import { z } from "zod";
import type { SubmissionType } from "@/lib/submissions/types";

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

/** A DATE column: a calendar day, never an instant. */
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date in YYYY-MM-DD form")
  .optional()
  .nullable()
  .or(z.literal(""));

export const classifiedEditSchema = z.object({
  categoryId: z.number().int().positive().optional().nullable(),
  title: z.string().min(1, "Title is required").max(255).optional(),
  description: z.string().min(1, "Description is required").optional(),
  // `decimal` in Postgres; Drizzle hands it back as a string.
  price: optionalText(20),
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
  alertType: optionalText(50),
  description: z.string().min(1, "Description is required").optional(),
  certifyingAgency: optionalText(200),
  effectiveDate: dateOnly,
  issueDate: dateOnly,
});

export const alertEditSchema = z.object({
  alertType: z.string().min(1).max(50).optional(),
  title: z.string().min(1, "Title is required").max(200).optional(),
  content: z.string().min(1, "Content is required").optional(),
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
  shivaStart: dateOnly,
  shivaEnd: dateOnly,
  shivaHours: optionalText(200),
  daveningTimes: z.string().optional().nullable(),
  levayaInfo: z.string().optional().nullable(),
  zoomInfo: z.string().optional().nullable(),
  minyanInfo: z.string().optional().nullable(),
  attachmentUrl: optionalText(500),
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
  commentModeration: z.enum(["open", "approved"]).optional().nullable(),
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
