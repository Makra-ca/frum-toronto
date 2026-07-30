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
  linkType: z.enum(AD_LINK_TYPES as [string, ...string[]]).default("none"),
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

export const createAdSchema = z.object(baseAdFields).superRefine(refineAd);

/** Edit allows changing anything, so an advertiser's replacement artwork keeps
 *  the ad's click history instead of forcing a delete-and-recreate. */
export const updateAdSchema = z.object(baseAdFields).partial().superRefine(refineAd);

/** Approve / reject is a separate action from editing the ad's content. */
export const moderateAdSchema = z.object({
  approvalStatus: z.enum(["approved", "rejected"]),
  rejectionReason: z.string().trim().max(1000).optional().nullable(),
});

export type CreateAdInput = z.infer<typeof createAdSchema>;
export type UpdateAdInput = z.infer<typeof updateAdSchema>;
