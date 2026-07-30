import { eq, and, gt, inArray, notInArray, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { homepageAds, businesses, blogPosts } from "@/lib/db/schema";
import {
  liveAdCondition,
  liveAdOrdering,
  ADS_PER_POSITION,
  type AdPlacement,
} from "@/lib/ads/live-ads";

/**
 * An ad as the homepage needs it: enough to render the slot, the overlay and the
 * destination button, and nothing else. `businessSlug` comes from a join rather
 * than being denormalised onto the ad, so a business renaming itself cannot leave
 * a stale link behind.
 */
export interface LiveAd {
  id: number;
  title: string;
  imageUrl: string;
  linkType: string;
  linkUrl: string | null;
  businessSlug: string | null;
  businessName: string | null;
}

/**
 * The ads that should be on the page right now, for one position.
 *
 * Random, limited to ADS_PER_POSITION. Every ad in the pool was deliberately put
 * there — by an admin placing it, or by an admin approving a business's
 * submission — so randomness only breaks ties between ads already judged equal.
 * Over many visitors, exposure evens out.
 *
 * LEFT JOIN, not INNER: an ad without a business is the normal case for a
 * community flyer, and `business_id` is ON DELETE SET NULL, so a deleted business
 * must not take its paid ad off the page silently.
 */
export async function getLiveAds(
  placement: AdPlacement,
  limit: number = ADS_PER_POSITION
): Promise<LiveAd[]> {
  return db
    .select({
      id: homepageAds.id,
      title: homepageAds.title,
      imageUrl: homepageAds.imageUrl,
      linkType: homepageAds.linkType,
      linkUrl: homepageAds.linkUrl,
      businessSlug: businesses.slug,
      businessName: businesses.name,
    })
    .from(homepageAds)
    .leftJoin(businesses, eq(homepageAds.businessId, businesses.id))
    .where(liveAdCondition(placement))
    .orderBy(...liveAdOrdering)
    .limit(limit);
}

/** How recently a business's owner must have posted to earn the reserved slot. */
const BLOG_ACTIVE_DAYS = 30;

/**
 * Fisher-Yates. The old implementation used `.sort(() => Math.random() - 0.5)`,
 * which is not a uniform shuffle — comparator-based shuffles bias toward leaving
 * elements near their original position. It matters here because the rotator
 * shows index 0 first, so the first slot is the most-seen one.
 */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The banner pool, with one slot preferring a blog-active advertiser.
 *
 * Ported from `/api/featured-businesses?include=bloggers`, which reserved one of
 * the three banner slots for a business whose owner had published an approved
 * post in the last 30 days. It survives the move to deliberate placement because
 * selection within a position is random anyway — a reserved slot is just another
 * way of choosing who is in the pool, not a reordering of someone's placement.
 *
 * Applies only to ads that have a `business_id`: a community flyer has no owner
 * who could blog. If no blog-active ad exists, the slot goes back to the general
 * pool rather than being left empty.
 */
export async function getBannerAds(): Promise<LiveAd[]> {
  const generalSlots = Math.max(1, ADS_PER_POSITION - 1);
  const general = await getLiveAds("banner", generalSlots);
  const taken = general.map((ad) => ad.id);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - BLOG_ACTIVE_DAYS);

  const activeAuthors = await db
    .selectDistinct({ userId: blogPosts.authorId })
    .from(blogPosts)
    .where(
      and(
        eq(blogPosts.approvalStatus, "approved"),
        eq(blogPosts.isActive, true),
        gt(blogPosts.publishedAt, cutoff)
      )
    );

  const authorIds = activeAuthors.map((row) => row.userId).filter((id): id is number => id !== null);

  let blogActive: LiveAd[] = [];
  if (authorIds.length > 0) {
    blogActive = await db
      .select({
        id: homepageAds.id,
        title: homepageAds.title,
        imageUrl: homepageAds.imageUrl,
        linkType: homepageAds.linkType,
        linkUrl: homepageAds.linkUrl,
        businessSlug: businesses.slug,
        businessName: businesses.name,
      })
      .from(homepageAds)
      // INNER join here, unlike getLiveAds: this slot is by definition for an ad
      // belonging to a business whose owner blogs.
      .innerJoin(businesses, eq(homepageAds.businessId, businesses.id))
      .where(
        and(
          liveAdCondition("banner"),
          isNotNull(businesses.userId),
          inArray(businesses.userId, authorIds),
          ...(taken.length > 0 ? [notInArray(homepageAds.id, taken)] : [])
        )
      )
      .orderBy(...liveAdOrdering)
      .limit(1);
  }

  let result = [...general, ...blogActive];

  // No blog-active advertiser: give the slot back to the general pool rather
  // than shipping a short banner.
  if (result.length < ADS_PER_POSITION) {
    const chosen = result.map((ad) => ad.id);
    const filler = await db
      .select({
        id: homepageAds.id,
        title: homepageAds.title,
        imageUrl: homepageAds.imageUrl,
        linkType: homepageAds.linkType,
        linkUrl: homepageAds.linkUrl,
        businessSlug: businesses.slug,
        businessName: businesses.name,
      })
      .from(homepageAds)
      .leftJoin(businesses, eq(homepageAds.businessId, businesses.id))
      .where(
        and(
          liveAdCondition("banner"),
          ...(chosen.length > 0 ? [notInArray(homepageAds.id, chosen)] : [])
        )
      )
      .orderBy(...liveAdOrdering)
      .limit(ADS_PER_POSITION - result.length);

    result = [...result, ...filler];
  }

  // Shuffle so the reserved slot is not always last.
  return shuffle(result);
}

/**
 * Both sidebar pools, merged, for the mobile strip.
 *
 * On phones there is one row of ads rather than two columns, and a sidebar
 * advertiser should not lose their placement on the device most visitors use.
 * Fetched concurrently because they are independent queries.
 */
export async function getMobileSidebarAds(): Promise<LiveAd[]> {
  const [left, right] = await Promise.all([
    getLiveAds("sidebar-left"),
    getLiveAds("sidebar-right"),
  ]);
  return [...left, ...right];
}
