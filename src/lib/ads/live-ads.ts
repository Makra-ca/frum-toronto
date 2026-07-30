import { and, eq, or, isNull, lte, gte, sql, type SQL } from "drizzle-orm";
import { homepageAds } from "@/lib/db/schema";

/**
 * Three independent positions, not two.
 *
 * `HomepageSidebarAds` takes a `position: "left" | "right"` prop that is declared,
 * destructured and never read — both columns fetched the same ads and rendered
 * identical content, mirrored. Splitting the sidebar makes "put this one on the
 * right" a real choice, and doubles sidebar inventory because the columns stop
 * duplicating each other.
 */
export type AdPlacement = "banner" | "sidebar-left" | "sidebar-right";
export type AdLinkType = "business" | "external" | "none";

export const AD_PLACEMENTS: AdPlacement[] = ["banner", "sidebar-left", "sidebar-right"];
export const AD_LINK_TYPES: AdLinkType[] = ["business", "external", "none"];

export const AD_PLACEMENT_LABELS: Record<AdPlacement, string> = {
  banner: "Banner (top)",
  "sidebar-left": "Left sidebar",
  "sidebar-right": "Right sidebar",
};

export function isAdPlacement(value: unknown): value is AdPlacement {
  return (AD_PLACEMENTS as string[]).includes(value as string);
}

/**
 * How many ads a single render shows per position.
 *
 * Selection is random from everyone eligible, so with a larger pool each visitor
 * sees a different three and exposure evens out across visitors rather than
 * within one page view.
 */
export const ADS_PER_POSITION = 3;

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
 * Random, and deliberately so.
 *
 * The old plan-based banners also used `ORDER BY random()`, but wrongly: nothing
 * deliberate happened before the randomness, since every business on a qualifying
 * tier was swept in automatically. Here, being in the pool at all is a decision —
 * an admin assigned this ad to this position, or approved a business's submission
 * into it. Randomness only breaks ties between ads that have already been judged
 * equal, which is what makes it fair rather than arbitrary.
 *
 * Consequence to keep in mind: with more than ADS_PER_POSITION ads in a position,
 * no individual ad is guaranteed to appear on any given page load. Pinning was
 * considered and rejected; `homepage_ads.sort_order` is retained but unread so
 * that adding it later is a small change rather than another migration.
 */
export const liveAdOrdering = [sql`RANDOM()`];

/** Only these may reach an href. Everything else is rejected, not repaired. */
const SAFE_URL_PROTOCOLS = new Set(["http:", "https:"]);

/** A leading scheme, e.g. "https:", "javascript:", "mailto:". */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Normalises an advertiser-supplied URL, or returns null if it cannot be trusted.
 *
 * Two separate problems, both real:
 *
 * 1. **No scheme.** Advertisers type "torahmasters.org". Left alone that is a
 *    *relative* href, so it resolves to frumtoronto.com/torahmasters.org and 404s.
 *    Eight other places in this repo prefix "https://" for exactly this reason.
 *
 * 2. **Dangerous schemes.** `link_url` is submitted by businesses and lands in an
 *    href, so `javascript:alert(1)` is a stored-XSS vector. Note that zod's
 *    `.url()` does NOT catch this — it is `new URL()` underneath, which accepts
 *    `javascript:` and `data:` as perfectly valid URLs while rejecting the
 *    scheme-less "torahmasters.org" that we actually want to accept.
 *
 * The repo's usual `startsWith("http") ? url : "https://" + url` idiom blocks
 * javascript: only by accident (it gets prefixed into nonsense) and still lets
 * "httpevil:x" through, since that does start with "http". This parses instead
 * and checks the protocol against an allowlist.
 *
 * Fails closed: an unusable URL returns null, matching the "points nowhere"
 * contract that callers already have to handle.
 */
export function normalizeAdUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  const candidate = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (!SAFE_URL_PROTOCOLS.has(parsed.protocol)) return null;

  // No hostname check is needed after the protocol allowlist: for http/https a
  // missing host makes `new URL()` throw ("https://" and "http://?q=1" both do),
  // so anything reaching here already has one. Verified rather than assumed —
  // note that "https:///nowhere" is NOT hostless, it parses as host "nowhere".
  return parsed.toString();
}

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
  if (ad.linkType === "external") {
    const href = normalizeAdUrl(ad.linkUrl);
    // An ad stored with an unusable URL renders as unclickable rather than as a
    // broken or hostile link. The admin list surfaces it; the visitor never does.
    return href ? { href, external: true } : null;
  }
  if (ad.linkType === "business" && ad.businessSlug) {
    return { href: `/directory/business/${ad.businessSlug}`, external: false };
  }
  return null;
}
