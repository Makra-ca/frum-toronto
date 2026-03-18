"use client";

import { AdminTabs } from "@/components/admin/AdminTabs";
import { Calendar, BookOpen, HelpCircle, ShoppingBag, Tag } from "lucide-react";

const programTabs = [
  { href: "/admin/programs/events", label: "Events", icon: Calendar },
  { href: "/admin/programs/shiurim", label: "Shiurim", icon: BookOpen },
  { href: "/admin/programs/rabbi", label: "Ask the Rabbi", icon: HelpCircle },
  { href: "/admin/programs/classifieds", label: "Classifieds", icon: ShoppingBag },
  { href: "/admin/programs/specials", label: "Specials", icon: Tag },
];

export default function ProgramsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Programs</h1>
        <p className="text-gray-600 mt-1">Manage events, shiurim, classifieds, and more</p>
      </div>
      <AdminTabs tabs={programTabs} />
      {children}
    </div>
  );
}
