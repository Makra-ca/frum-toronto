import { z } from "zod";
import { AD_PLACEMENTS, AD_LINK_TYPES } from "@/lib/ads/live-ads";
import { isSafeExternalUrl } from "@/lib/safe-url";

/**
 * Mirrors the CHECK constraints on `homepage_ads` so a bad ad is rejected with a
 * readable message rather than a Postgres error. The database keeps its
 * constraints regardless — an ad that cannot render is worse than a rejected
 * write, so it is guarded in both places rather than trusting this layer alone.
 */

const optionalDate = z
  .string()
  .datetime({ offset: true })
  .or(z.literal(""))
  .optional()
  .nullable();

const baseAdFields = {
  title: z.string().trim().min(1, "Give the ad a title").max(200),
  imageUrl: z.string().trim().min(1, "Upload an image").max(500),
  placement: z.enum(AD_PLACEMENTS as [string, ...string[]], {
    message: "Choose where the ad appears",
  }),
  /*
    NO `.default()` here — that was a live data-loss bug.

    `.partial()` does NOT strip a Zod default: it wraps the defaulted schema, and
    the default still fires when the key is absent. So `updateAdSchema.safeParse({
    isActive: false })` returned `{ linkType: "none", isActive: false }`, the
    PATCH route's `if (data.linkType !== undefined)` was ALWAYS true, and every
    edit — including the one-click on/off toggle — silently reset the ad's link
    to none and nulled its URL.

    The default now lives on createAdSchema alone, where "absent means none" is
    actually what is meant.
  */
  linkType: z.enum(AD_LINK_TYPES as [string, ...string[]]),
  // NOT z.string().url(): that rejects "torahmasters.org" — which is what people
  // type — while accepting "javascript:alert(1)". Checked with isSafeExternalUrl
  // in the refinement below instead.
  linkUrl: z.string().trim().max(500).optional().nullable(),
  businessId: z.number().int().positive().optional().nullable(),
  startsAt: optionalDate,
  endsAt: optionalDate,
  isActive: z.boolean().optional(),
};

/**
 * The combinations the database rejects, expressed as messages a person can act
 * on. Each corresponds to a CHECK constraint: an ad that points nowhere despite
 * claiming a destination would render a dead click, and a backwards date window
 * would silently never show.
 */
interface AdRuleShape {
  linkType?: string;
  linkUrl?: string | null;
  businessId?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
}

function refineAd(data: AdRuleShape, ctx: z.RefinementCtx) {
  if (data.linkType === "external") {
    if (!data.linkUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["linkUrl"],
        message: "Enter the web address this ad should link to",
      });
    } else if (!isSafeExternalUrl(data.linkUrl)) {
      ctx.addIssue({
        code: "custom",
        path: ["linkUrl"],
        message:
          "Enter a valid web address, e.g. torahmasters.org or https://torahmasters.org",
      });
    }
  }

  if (data.linkType === "business" && !data.businessId) {
    ctx.addIssue({
      code: "custom",
      path: ["businessId"],
      message: "Choose the business this ad links to",
    });
  }

  if (data.startsAt && data.endsAt && new Date(data.endsAt) <= new Date(data.startsAt)) {
    ctx.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "The end date must be after the start date",
    });
  }
}

export const createAdSchema = z
  .object({
    ...baseAdFields,
    // "Absent means none" is correct on CREATE and only on CREATE.
    linkType: z.enum(AD_LINK_TYPES as [string, ...string[]]).default("none"),
  })
  .superRefine(refineAd);

/**
 * Edit allows changing anything, so an advertiser's replacement artwork keeps
 * the ad's click history instead of forcing a delete-and-recreate.
 *
 * Every field is genuinely optional here: an absent key must mean "leave it
 * alone", which is only true because `baseAdFields` carries no defaults.
 *
 * Cross-field rules (link target, date order) cannot be checked on a partial
 * body alone — the missing half lives in the stored row — so the route merges
 * this over the existing ad and validates the RESULT with `adRulesSchema`.
 */
export const updateAdSchema = z
  .object(baseAdFields)
  .partial()
  /*
    URL SAFETY is checked here even though completeness is not.

    The difference: "is this URL safe" needs only the value in front of us, so it
    can be judged on a fragment. "Does this ad have a link target" needs the
    stored row, so it cannot. Dropping the whole refinement when this schema
    became partial silently allowed `javascript:` through — caught by an existing
    test, which is the only reason it is not still there.
  */
  .superRefine((data, ctx) => {
    if (data.linkUrl && !isSafeExternalUrl(data.linkUrl)) {
      ctx.addIssue({
        code: "custom",
        path: ["linkUrl"],
        message:
          "Enter a valid web address, e.g. torahmasters.org or https://torahmasters.org",
      });
    }
  });

/**
 * The cross-field rules, applied to a fully-resolved ad.
 *
 * Used by the PATCH route after merging a partial edit onto the stored row, so
 * that e.g. changing only `startsAt` is still checked against the `endsAt`
 * already in the database — which previously slipped past Zod and died on the
 * database CHECK as a 500.
 */
export const adRulesSchema = z
  .object({
    linkType: z.enum(AD_LINK_TYPES as [string, ...string[]]),
    linkUrl: z.string().trim().max(500).optional().nullable(),
    businessId: z.number().int().positive().optional().nullable(),
    startsAt: z.union([z.string(), z.date()]).optional().nullable(),
    endsAt: z.union([z.string(), z.date()]).optional().nullable(),
  })
  .superRefine((data, ctx) =>
    refineAd(
      {
        linkType: data.linkType,
        linkUrl: data.linkUrl,
        businessId: data.businessId,
        startsAt: data.startsAt ? new Date(data.startsAt).toISOString() : null,
        endsAt: data.endsAt ? new Date(data.endsAt).toISOString() : null,
      },
      ctx
    )
  );

/** Approve / reject is a separate action from editing the ad's content. */
export const moderateAdSchema = z.object({
  approvalStatus: z.enum(["approved", "rejected"]),
  rejectionReason: z.string().trim().max(1000).optional().nullable(),
});

export type CreateAdInput = z.infer<typeof createAdSchema>;
export type UpdateAdInput = z.infer<typeof updateAdSchema>;
