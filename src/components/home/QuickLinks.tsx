import Link from "next/link";
import {
  Building2,
  Calendar,
  ShoppingBag,
  Users,
  BookOpen,
  Bell,
  Heart,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const quickLinks = [
  {
    title: "Business Directory",
    description: "Find local kosher businesses",
    href: "/directory",
    icon: Building2,
    color: "bg-blue-500",
  },
  {
    title: "Shuls & Davening",
    description: "Minyan times & locations",
    href: "/shuls",
    icon: Users,
    color: "bg-indigo-500",
  },
  {
    title: "Events Calendar",
    description: "Community events & shiurim",
    href: "/calendar",
    icon: Calendar,
    color: "bg-green-500",
  },
  {
    title: "Classifieds",
    description: "Buy, sell & trade",
    href: "/classifieds",
    icon: ShoppingBag,
    color: "bg-orange-500",
  },
  {
    title: "Weekly Shiurim",
    description: "Torah classes schedule",
    href: "/shiurim",
    icon: BookOpen,
    color: "bg-purple-500",
  },
  {
    title: "Alerts & Bulletins",
    description: "Community announcements",
    href: "/alerts",
    icon: Bell,
    color: "bg-red-500",
  },
  {
    title: "Simchas",
    description: "Celebrate with the community",
    href: "/simchas",
    icon: Heart,
    color: "bg-pink-500",
  },
  {
    title: "Ask The Rabbi",
    description: "Halachic Q&A archive",
    href: "/ask-the-rabbi",
    icon: MessageSquare,
    color: "bg-teal-500",
  },
];

export function QuickLinks() {
  return (
    <section>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Explore</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <div
                  className={`${link.color} w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3`}
                >
                  <link.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">
                  {link.title}
                </h3>
                <p className="text-xs text-gray-500">{link.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
