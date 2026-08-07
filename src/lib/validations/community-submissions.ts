import { z } from "zod";

/**
 * Schemas for the public submission routes.
 *
 * These four took the request body raw — destructured it and hand-checked two
 * or three fields — which is the house style of everything written before the
 * shared submission handler existed. The `[id]` EDIT routes were built later
 * and all validate properly; only the CREATE half was left behind.
 *
 * What raw bodies actually cost, measured against the real columns:
 *
 *   familyName 201 chars -> "value too long for type character varying(200)"
 *   eventDate "24/04/2026" -> "date/time field value out of range"
 *
 * Both surface as a 500. Someone posting a mazel tov sees "Something went
 * wrong", with nothing saying which field to fix, and the error lands in the
 * logs rather than on their screen. The hand-rolled checks caught EMPTY, which
 * is the case whoever wrote them was thinking about; too long, wrong format and
 * wrong type all fell through to Postgres.
 *
 * Every `max()` here mirrors its column exactly. If a column is widened, this
 * file is the other half of that change.
 */

/** Trimmed, non-empty, capped — the shape most of these fields want. */
const text = (max: number, label: string) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} must be ${max} characters or less`);

/** Optional free text: "" and null both mean "not provided". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null);

/** Matches a `date` column. No time, no timezone, nothing to convert. */
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date in YYYY-MM-DD form");

// ─────────────────────────────────────────────────────────────────────────────
// Alerts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * These were already checked against inline arrays in the route. Declaring
 * them as enums keeps the list in one place and, unlike the old code, means an
 * unknown `urgency` is REJECTED rather than silently rewritten to "normal" —
 * someone marking an alert urgent should not have it quietly downgraded.
 */
export const ALERT_TYPES = ["general", "bulletin", "announcement", "warning"] as const;
export const ALERT_URGENCIES = ["normal", "high", "urgent"] as const;

export const communityAlertSchema = z.object({
  title: text(200, "Title"),
  content: z.string().trim().min(10, "Content must be at least 10 characters"),
  alertType: z.enum(ALERT_TYPES, { message: "Choose a valid alert type" }),
  urgency: z.enum(ALERT_URGENCIES).optional().default("normal"),
});

// ─────────────────────────────────────────────────────────────────────────────
// Classifieds
// ─────────────────────────────────────────────────────────────────────────────

export const PRICE_TYPES = ["fixed", "negotiable", "free"] as const;

export const communityClassifiedSchema = z.object({
  title: text(255, "Title"),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters")
    .max(2000, "Description must be 2,000 characters or less"),
  categoryId: z.coerce
    .number({ message: "Category is required" })
    .int()
    .positive("Category is required"),
  // A decimal(10,2) column. Coerced because a form sends a string, and bounded
  // because 10 digits is what the column holds.
  price: z.coerce
    .number()
    .nonnegative("Price cannot be negative")
    .max(99_999_999, "Price is too large")
    .optional()
    .nullable(),
  priceType: z.enum(PRICE_TYPES).optional().nullable(),
  contactName: optionalText(100),
  contactEmail: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(255)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  contactPhone: optionalText(40),
  location: optionalText(200),
  imageUrl: optionalText(500),
});

// ─────────────────────────────────────────────────────────────────────────────
// Shiva
// ─────────────────────────────────────────────────────────────────────────────

export const communityShivaSchema = z
  .object({
    niftarName: text(200, "Name of the niftar/nifteres"),
    niftarNameHebrew: optionalText(200),
    // JSONB. Blank entries are dropped rather than stored as empty strings.
    mournerNames: z
      .array(z.string().trim().max(200))
      .optional()
      .nullable()
      .transform((v) => (v ? v.filter(Boolean) : null)),
    shivaAddress: optionalText(500),
    shivaStart: dateOnly,
    shivaEnd: dateOnly,
    shivaHours: optionalText(200),
    daveningTimes: optionalText(5000),
    levayaInfo: optionalText(5000),
    zoomInfo: optionalText(5000),
    minyanInfo: optionalText(5000),
    mealInfo: optionalText(5000),
    donationInfo: optionalText(5000),
    contactPhone: optionalText(40),
    attachmentUrl: optionalText(500),
  })
  .refine((v) => v.shivaEnd >= v.shivaStart, {
    // The public page shows notices where shiva_end >= today, so an inverted
    // range makes the notice invisible from the moment it is posted — the one
    // outcome nobody would want on a bereavement notice.
    message: "Shiva cannot end before it starts",
    path: ["shivaEnd"],
  });

// ─────────────────────────────────────────────────────────────────────────────
// Tehillim
// ─────────────────────────────────────────────────────────────────────────────

export const communityTehillimSchema = z
  .object({
    hebrewName: optionalText(200),
    englishName: optionalText(200),
    motherHebrewName: optionalText(200),
    reason: optionalText(200),
    // 1–30 matches the clamp the route already applies (default 14). The old
    // code silently rewrote anything outside that range — `parseInt("abc")`
    // became 14, and 900 became 30 — so someone asking for 90 days was told
    // nothing and got 30. Rejecting says what happened.
    durationDays: z.coerce
      .number()
      .int()
      .min(1, "Duration must be at least one day")
      .max(30, "Duration cannot exceed 30 days")
      .optional()
      .nullable(),
  })
  .refine((v) => Boolean(v.hebrewName || v.englishName), {
    message: "Either Hebrew name or English name is required",
    path: ["hebrewName"],
  });
