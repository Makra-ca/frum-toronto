"use client";

import { AdminTabs } from "@/components/admin/AdminTabs";
import { Building2, FolderTree, CreditCard, Heart, Video, Megaphone } from "lucide-react";

const businessTabs = [
  { href: "/admin/businesses", label: "All Businesses", icon: Building2, exact: true },
  { href: "/admin/businesses/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/businesses/plans", label: "Plans", icon: CreditCard },
  { href: "/admin/businesses/non-profit", label: "Non-Profit", icon: Heart },
  { href: "/admin/businesses/video-review", label: "Video Review", icon: Video },
  { href: "/admin/businesses/shoutouts", label: "Shoutouts", icon: Megaphone },
];

export default function BusinessesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Businesses</h1>
        <p className="text-gray-600 mt-1">Manage business listings, categories, and subscription plans</p>
      </div>
      <AdminTabs tabs={businessTabs} />
      {children}
    </div>
  );
}
