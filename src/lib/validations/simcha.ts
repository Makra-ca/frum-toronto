import { z } from "zod";

/**
 * One schema for every path that creates a simcha.
 *
 * The public route had none at all — it destructured the raw body and
 * hand-checked two fields, so `eventDate` reached the insert unvalidated and
 * an over-length `familyName` or `location` threw a raw Postgres error instead
 * of a 400.
 *
 * `eventDate` is REQUIRED now, and that is a change of kind rather than of
 * strictness. Since `/simchas` sorts by `COALESCE(event_date, created_at)`,
 * the date is no longer decoration — it is where the announcement appears on
 * the page. A blank one files it under the day it was typed, silently, because
 * the page never shows a post date for a reader to compare against.
 *
 * The 16,542 imported rows keep their NULL. This governs writes, not history.
 */

/** Matches the `date` column: no time, no timezone, nothing to convert. */
export const simchaDateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date of the simcha")
  .refine((v) => !Number.isNaN(Date.parse(v)), "That is not a real date");

// Lengths mirror the columns exactly (varchar 200/200/500), so an over-length
// value is a clean 400 rather than a database error surfacing as a 500.
export const simchaCreateSchema = z.object({
  familyName: z.string().trim().min(1, "Family name is required").max(200),
  announcement: z
    .string()
    .trim()
    .min(10, "Announcement must be at least 10 characters")
    .max(5000),
  typeId: z.coerce.number().int().positive().optional().nullable(),
  eventDate: simchaDateField,
  location: z.string().trim().max(200).optional().nullable(),
  photoUrl: z.string().trim().max(500).optional().nullable(),
});

/**
 * Editing. Every field is optional so a partial update stays possible, but
 * `eventDate` may not be BLANKED — clearing it would drop the announcement
 * back to sorting by its post date, which is the problem this all fixes.
 */
export const simchaUpdateSchema = simchaCreateSchema.partial().extend({
  eventDate: simchaDateField.optional(),
});

export type SimchaCreateInput = z.infer<typeof simchaCreateSchema>;
