import { getLiveAds, getBannerAds, getMobileSidebarAds } from "@/lib/ads/queries";
import { AdRotator } from "@/components/homepage/AdRotator";
import { AdStrip } from "@/components/homepage/AdStrip";

/**
 * Server components: the ads are fetched during the page render rather than by a
 * client `useEffect`.
 *
 * The old components each fired their own `/api/featured-businesses` request
 * after mount, so the homepage rendered, then popped three ad slots into place a
 * round trip later. The page is already `force-dynamic`, so fetching here costs
 * nothing extra and removes the flash.
 *
 * Note there is deliberately no "Sponsored" caption anywhere in these slots. The
 * old components carried one in three places; it was removed as a decision, the
 * alternative considered being "Sponsored" for paid ads and "Community" for free
 * flyers.
 */

export async function HomepageBannerAds() {
  // getBannerAds, not getLiveAds: the banner keeps the reserved slot for an
  // advertiser whose owner has blogged recently, ported from the old
  // /api/featured-businesses?include=bloggers path.
  const ads = await getBannerAds();

  return (
    <section className="w-full bg-gradient-to-r from-slate-900 to-slate-800 py-4">
      <div className="container mx-auto px-4">
        <AdRotator ads={ads} variant="banner" label="Featured advertisers" />
      </div>
    </section>
  );
}

export async function HomepageSidebarAd({ side }: { side: "left" | "right" }) {
  // Each side is its own pool. Previously both columns fetched the same ads and
  // rendered identical content, because the position prop was never read.
  const ads = await getLiveAds(side === "left" ? "sidebar-left" : "sidebar-right");

  return (
    <AdRotator
      ads={ads}
      variant="sidebar"
      label={side === "left" ? "Featured advertisers, left" : "Featured advertisers, right"}
    />
  );
}

/**
 * Phones get one row instead of two columns, carrying both sidebar pools.
 *
 * A sidebar advertiser should not vanish on the device most visitors use, so the
 * pools are merged rather than one being dropped.
 */
export async function HomepageMobileAds() {
  const ads = await getMobileSidebarAds();
  if (ads.length === 0) return null;

  return <AdStrip ads={ads} />;
}
