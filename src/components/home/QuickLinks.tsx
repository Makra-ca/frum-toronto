import Link from "next/link";
import {
  Building2,
  Landmark,
  Calendar,
  Tag,
  BookOpen,
  Bell,
  Heart,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";

// The icons deliberately match the ones the hero dial uses for the same
// destinations (see heroNodes.ts) so the two sections read as one system. They
// are repeated here rather than looked up from HERO_NODES because this list is
// not the same list: Alerts & Bulletins has no place on the dial, and the dial
// carries Zmanim, which is not here. A lookup would hide that mismatch.
interface QuickLink {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

const quickLinks: QuickLink[] = [
  {
    title: "Business Directory",
    description: "Find local kosher businesses",
    href: "/directory",
    icon: Building2,
  },
  {
    title: "Shuls & Davening",
    description: "Minyan times & locations",
    href: "/shuls",
    icon: Landmark,
  },
  {
    title: "Events Calendar",
    description: "Community events & shiurim",
    href: "/community/calendar",
    icon: Calendar,
  },
  {
    title: "Classifieds",
    description: "Buy, sell & trade",
    href: "/classifieds",
    icon: Tag,
  },
  {
    title: "Weekly Shiurim",
    description: "Torah classes schedule",
    href: "/shiurim",
    icon: BookOpen,
  },
  {
    title: "Alerts & Bulletins",
    description: "Community announcements",
    href: "/alerts",
    icon: Bell,
  },
  {
    title: "Simchas",
    description: "Celebrate with the community",
    href: "/simchas",
    icon: Heart,
  },
  {
    title: "Ask The Rabbi",
    description: "Halachic Q&A archive",
    href: "/ask-the-rabbi",
    icon: MessageCircle,
  },
];

export function QuickLinks() {
  return (
    <section>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Explore</h2>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {quickLinks.map(({ title, description, href, icon: Icon }) => (
          // The Link is the tile — no inner wrapper div. The whole surface was
          // already the click target; the old chevron only implied it.
          <Link
            key={href}
            href={href}
            className="group flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 sm:p-5"
          >
            <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100">
              <Icon className="h-5 w-5" />
            </span>

            {/* font-ui (Assistant) rather than the page's Cormorant: Cormorant is
                loaded at 300/400 only, so a semibold title would render at the
                same weight as its own description and the tile would have no
                hierarchy at all. Assistant keeps its real 200–800 axis. */}
            <h3 className="font-ui text-[15px] font-semibold leading-snug text-gray-900">
              {title}
            </h3>
            <p className="font-ui mt-1 text-[13px] leading-snug text-gray-700">
              {description}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
