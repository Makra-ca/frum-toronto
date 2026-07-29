import Link from "next/link";
import { ChevronRight } from "lucide-react";

const quickLinks = [
  {
    title: "Business Directory",
    description: "Find local kosher businesses",
    href: "/directory",
    accent: "border-l-blue-500",
  },
  {
    title: "Shuls & Davening",
    description: "Minyan times & locations",
    href: "/shuls",
    accent: "border-l-indigo-500",
  },
  {
    title: "Events Calendar",
    description: "Community events & shiurim",
    href: "/community/calendar",
    accent: "border-l-green-500",
  },
  {
    title: "Classifieds",
    description: "Buy, sell & trade",
    href: "/classifieds",
    accent: "border-l-orange-500",
  },
  {
    title: "Weekly Shiurim",
    description: "Torah classes schedule",
    href: "/shiurim",
    accent: "border-l-purple-500",
  },
  {
    title: "Alerts & Bulletins",
    description: "Community announcements",
    href: "/alerts",
    accent: "border-l-red-500",
  },
  {
    title: "Simchas",
    description: "Celebrate with the community",
    href: "/simchas",
    accent: "border-l-pink-500",
  },
  {
    title: "Ask The Rabbi",
    description: "Halachic Q&A archive",
    href: "/ask-the-rabbi",
    accent: "border-l-teal-500",
  },
];

export function QuickLinks() {
  return (
    <section>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Explore</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <div
              className={`h-full border-l-3 ${link.accent} bg-white rounded-lg px-4 py-3.5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer`}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {link.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">{link.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0 ml-2" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
