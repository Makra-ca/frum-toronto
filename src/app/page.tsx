// The dial hero runs to the top of the page with the fixed pill nav floating over
// it — hence `underFixedNav` (the default) and no spacer from LayoutWrapper on
// this route. The alternatives live at /comparison-hero: OriginalHero and
// PhotoHero, both drop-in replacements taking the same props.
import { HeroSection } from "@/components/home/hero/HeroSection";
import { getHeroData } from "@/lib/hero/heroData";
import { CommunityCornerTabs } from "@/components/home/CommunityCornerTabs";
import { QuickLinks } from "@/components/home/QuickLinks";
import { AskTheRabbiCta } from "@/components/home/AskTheRabbiCta";
import { FeaturedBusinesses } from "@/components/home/FeaturedBusinesses";
import { UpcomingEvents } from "@/components/home/UpcomingEvents";
import { ZmanimWidget } from "@/components/widgets/ZmanimWidget";
import { EruvWidget } from "@/components/widgets/EruvWidget";
import { WeatherWidget } from "@/components/widgets/WeatherWidget";
import { OmerWidget } from "@/components/widgets/OmerWidget";
import {
  HomepageBannerAds,
  HomepageSidebarAd,
  HomepageMobileAds,
} from "@/components/homepage/AdSlots";

// The hero renders live zmanim, eruv status and counts on the server, and the ad
// components below read admin-managed content. Without this the page would be
// statically prerendered and all of it frozen at build time.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const hero = await getHeroData();

  return (
    <div>
      {/* Hero Section */}
      <HeroSection zmanim={hero.zmanim} eruv={hero.eruv} counts={hero.counts} />

      {/* Ask The Rabbi CTA - between the hero and the banner strip */}
      <AskTheRabbiCta />

      {/* Banner Ads - After Hero */}
      <HomepageBannerAds />

      {/* Main Content with Sidebar Ads on Both Sides */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-[200px_1fr_200px] gap-6 xl:gap-8">
          {/* Left Sidebar Ad - Desktop only (xl screens) */}
          <aside className="hidden xl:block">
            <div className="sticky top-24">
              <HomepageSidebarAd side="left" />
            </div>
          </aside>

          {/* Main Column */}
          <div className="space-y-8">
            {/* Quick Links / Explore */}
            <QuickLinks />

            {/* Mobile Sidebar Ads - Below Explore section */}
            <div className="xl:hidden">
              <HomepageMobileAds />
            </div>

            {/* Community Corner */}
            <CommunityCornerTabs />

            {/* Featured Businesses */}
            <FeaturedBusinesses />

            {/* Upcoming Events */}
            <UpcomingEvents />
          </div>

          {/* Right Sidebar Ad - Desktop only (xl screens) */}
          <aside className="hidden xl:block">
            <div className="sticky top-24">
              <HomepageSidebarAd side="right" />
            </div>
          </aside>
        </div>

        {/* Widgets Section - Below main content */}
        {/* OmerWidget returns null outside the Omer period, leaving the original 3-col layout intact */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          <OmerWidget />
          <ZmanimWidget />
          <EruvWidget />
          <WeatherWidget />
        </div>
      </div>
    </div>
  );
}
