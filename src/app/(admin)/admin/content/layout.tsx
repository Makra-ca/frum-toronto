"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ClipboardCheck, Heart, ShoppingBag, BookHeart, Flower2 } from "lucide-react";

const contentTabs = [
  { href: "/admin/content/approvals", label: "Approvals", icon: ClipboardCheck },
  { href: "/admin/content/tehillim", label: "Tehillim", icon: BookHeart },
  { href: "/admin/content/shiva", label: "Shiva", icon: Flower2 },
  { href: "/admin/content/simchas", label: "Simchas", icon: Heart },
  { href: "/admin/content/classifieds", label: "Classifieds", icon: ShoppingBag },
];

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Content Management</h1>
        <p className="text-gray-600 mt-1">
          Manage community content submissions
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4 -mb-px">
          {contentTabs.map((tab) => {
            const isActive = pathname === tab.href ||
              (tab.href === "/admin/content/approvals" && pathname === "/admin/content");

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  isActive
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Page Content */}
      {children}
    </div>
  );
}
