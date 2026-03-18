"use client";

import { AdminTabs } from "@/components/admin/AdminTabs";
import { Heart, Flower2, BookHeart, Bell, ShieldAlert, MapPin, Phone } from "lucide-react";

const communityTabs = [
  { href: "/admin/community/simchas", label: "Simchas", icon: Heart },
  { href: "/admin/community/shiva", label: "Shiva", icon: Flower2 },
  { href: "/admin/community/tehillim", label: "Tehillim", icon: BookHeart },
  { href: "/admin/community/alerts", label: "Alerts", icon: Bell },
  { href: "/admin/community/kosher-alerts", label: "Kosher Alerts", icon: ShieldAlert },
  { href: "/admin/community/eruv", label: "Eruv", icon: MapPin },
  { href: "/admin/community/important-numbers", label: "Important Numbers", icon: Phone },
];

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Community</h1>
        <p className="text-gray-600 mt-1">Manage simchas, shiva, tehillim, alerts, and community resources</p>
      </div>
      <AdminTabs tabs={communityTabs} />
      {children}
    </div>
  );
}
