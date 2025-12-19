import { HeroSection } from "@/components/home/HeroSection";
import { CommunityCornerTabs } from "@/components/home/CommunityCornerTabs";
import { QuickLinks } from "@/components/home/QuickLinks";
import { FeaturedBusinesses } from "@/components/home/FeaturedBusinesses";
import { UpcomingEvents } from "@/components/home/UpcomingEvents";
import { ZmanimWidget } from "@/components/widgets/ZmanimWidget";
import { EruvWidget } from "@/components/widgets/EruvWidget";
import { WeatherWidget } from "@/components/widgets/WeatherWidget";

export default function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <HeroSection />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Links */}
            <QuickLinks />

            {/* Community Corner */}
            <CommunityCornerTabs />

            {/* Featured Businesses */}
            <FeaturedBusinesses />

            {/* Upcoming Events */}
            <UpcomingEvents />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Zmanim Widget */}
            <ZmanimWidget />

            {/* Eruv Status */}
            <EruvWidget />

            {/* Weather Widget */}
            <WeatherWidget />
          </div>
        </div>
      </div>
    </div>
  );
}
