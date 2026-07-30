import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { homepageAds } from "@/lib/db/schema";
import type { AdPlacement } from "@/lib/ads/live-ads";

/**
 * What a business may submit, and where it lands.
 *
 * Kept out of the route so the rules can be tested without standing up
 * next-auth, and so the dashboard and the API agree on them.
 */

/**
 * A cap on how many ads one business may have on file at once.
 *
 * Not a spam-prevention measure so much as a runaway guard — every submission is
 * reviewed by an admin, so nothing reaches the page unapproved. It exists so a
 * scripted or accidental loop cannot fill the review queue.
 */
export const MAX_ADS_PER_BUSINESS = 5;

/** What a plan grants, as the business-facing choice rather than raw positions. */
export type SubmittablePlacement = "banner" | "sidebar";

export function allowedPlacements(plan: {
  showInHomepageBanner?: boolean | null;
  showInHomepageSidebar?: boolean | null;
}): SubmittablePlacement[] {
  const allowed: SubmittablePlacement[] = [];
  if (plan.showInHomepageBanner) allowed.push("banner");
  if (plan.showInHomepageSidebar) allowed.push("sidebar");
  return allowed;
}

/**
 * Turns the business-facing choice into a real position.
 *
 * "Which sidebar?" is a question no advertiser has an opinion about — they asked
 * for a sidebar, not for the left one. So the side is chosen here, by putting the
 * ad wherever there is currently less competition, which keeps the two columns
 * roughly balanced instead of everything piling into whichever one is listed
 * first. An admin can move it afterwards.
 *
 * Counts every ad in the position, not just live ones: a pending ad is about to
 * become competition, and an expired one is not, but balancing on the full set
 * is the stabler signal and avoids ping-ponging as schedules start and end.
 */
export async function resolvePlacement(
  choice: SubmittablePlacement
): Promise<AdPlacement> {
  if (choice === "banner") return "banner";

  const counts = await db
    .select({
      placement: homepageAds.placement,
      count: sql<number>`count(*)`,
    })
    .from(homepageAds)
    .groupBy(homepageAds.placement);

  const countFor = (placement: string) =>
    Number(counts.find((row) => row.placement === placement)?.count ?? 0);

  // Ties go left, which is arbitrary but has to be something.
  return countFor("sidebar-right") < countFor("sidebar-left")
    ? "sidebar-right"
    : "sidebar-left";
}

/** How many ads this business already has on file. */
export async function countAdsForBusiness(businessId: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(homepageAds)
    .where(eq(homepageAds.businessId, businessId));
  return Number(row?.count ?? 0);
}

/** The caller's own ad, or undefined — used to authorise edits and deletes. */
export async function findOwnAd(adId: number, businessId: number) {
  const [ad] = await db
    .select()
    .from(homepageAds)
    .where(and(eq(homepageAds.id, adId), eq(homepageAds.businessId, businessId)))
    .limit(1);
  return ad;
}
