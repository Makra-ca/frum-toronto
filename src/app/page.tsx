import { HeroSection } from "@/components/home/HeroSection";
import { CommunityCornerTabs } from "@/components/home/CommunityCornerTabs";
import { QuickLinks } from "@/components/home/QuickLinks";
import { FeaturedBusinesses } from "@/components/home/FeaturedBusinesses";
import { UpcomingEvents } from "@/components/home/UpcomingEvents";
import { ZmanimWidget } from "@/components/widgets/ZmanimWidget";
import { EruvWidget } from "@/components/widgets/EruvWidget";
import { WeatherWidget } from "@/components/widgets/WeatherWidget";
import { HomepageBanner } from "@/components/homepage/HomepageBanner";
import { HomepageSidebarAds, HomepageSidebarAdsMobile } from "@/components/homepage/HomepageSidebarAds";

export default function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <HeroSection />

      {/* Banner Ads - After Hero */}
      <HomepageBanner />

      {/* Main Content with Sidebar Ads on Both Sides */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-[200px_1fr_200px] gap-6 xl:gap-8">
          {/* Left Sidebar Ad - Desktop only (xl screens) */}
          <aside className="hidden xl:block">
            <div className="sticky top-24">
              <HomepageSidebarAds position="left" />
            </div>
          </aside>

          {/* Main Column */}
          <div className="space-y-8">
            {/* Quick Links / Explore */}
            <QuickLinks />

            {/* Mobile Sidebar Ads - Below Explore section */}
            <div className="xl:hidden">
              <HomepageSidebarAdsMobile />
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
              <HomepageSidebarAds position="right" />
            </div>
          </aside>
        </div>

        {/* Widgets Section - Below main content */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          <ZmanimWidget />
          <EruvWidget />
          <WeatherWidget />
        </div>
      </div>
    </div>
  );
}
