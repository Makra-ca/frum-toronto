import { and, eq, or, isNull, lte, gte, asc, desc, type SQL } from "drizzle-orm";
import { homepageAds } from "@/lib/db/schema";

export type AdPlacement = "banner" | "sidebar";
export type AdLinkType = "business" | "external" | "none";

export const AD_PLACEMENTS: AdPlacement[] = ["banner", "sidebar"];
export const AD_LINK_TYPES: AdLinkType[] = ["business", "external", "none"];

export function isAdPlacement(value: unknown): value is AdPlacement {
  return value === "banner" || value === "sidebar";
}

/**
 * The condition for "this ad should be on the page right now".
 *
 * Kept in one place because it is used by the public render, the admin preview
 * and the tests. Duplicating four separate clauses across those call sites is
 * how a scheduled ad ends up visible after it expires in one of them.
 *
 * `now` is a parameter rather than `new Date()` inside, so tests can ask what
 * would be live at an arbitrary moment without waiting for the clock.
 */
export function liveAdCondition(placement: AdPlacement, now: Date = new Date()): SQL {
  return and(
    eq(homepageAds.placement, placement),
    eq(homepageAds.approvalStatus, "approved"),
    eq(homepageAds.isActive, true),
    // NULL means unbounded at that end, so an ad with neither date always runs.
    or(isNull(homepageAds.startsAt), lte(homepageAds.startsAt, now)),
    or(isNull(homepageAds.endsAt), gte(homepageAds.endsAt, now))
  ) as SQL;
}

/**
 * Deliberate ordering, unlike the plan-based banners which use `ORDER BY random()`.
 * Someone paying for a placement should be able to rely on where it appears;
 * `created_at` breaks ties so equal sort_order stays stable between renders
 * rather than flickering.
 */
export const liveAdOrdering = [asc(homepageAds.sortOrder), desc(homepageAds.createdAt)];

/**
 * Resolves where an ad points.
 *
 * Returns null when it points nowhere, which is a real case: a flyer carrying a
 * phone number needs no click-through, and the overlay alone is the whole point.
 * Callers must handle null rather than falling back to "#".
 */
export function resolveAdHref(ad: {
  linkType: string;
  linkUrl: string | null;
  businessSlug?: string | null;
}): { href: string; external: boolean } | null {
  if (ad.linkType === "external" && ad.linkUrl) {
    return { href: ad.linkUrl, external: true };
  }
  if (ad.linkType === "business" && ad.businessSlug) {
    return { href: `/directory/business/${ad.businessSlug}`, external: false };
  }
  return null;
}
