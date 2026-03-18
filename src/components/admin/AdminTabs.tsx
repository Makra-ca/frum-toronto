"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Tab {
  href: string;
  label: string;
  icon?: LucideIcon;
  exact?: boolean;
}

interface AdminTabsProps {
  tabs: Tab[];
}

export function AdminTabs({ tabs }: AdminTabsProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: horizontal underline tabs */}
      <div className="hidden sm:block border-b border-gray-200">
        <nav className="flex gap-4 -mb-px">
          {tabs.map((tab) => {
            const isActive = tab.exact
              ? pathname === tab.href
              : pathname === tab.href ||
                pathname.startsWith(tab.href + "/");

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                {tab.icon && <tab.icon className="h-4 w-4" />}
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Mobile: vertical stack */}
      <div className="sm:hidden flex flex-col gap-1 bg-gray-50 rounded-lg p-2">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname === tab.href ||
              pathname.startsWith(tab.href + "/");

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-200"
              )}
            >
              {tab.icon && <tab.icon className="h-4 w-4" />}
              {tab.label}
            </Link>
          );
        })}
      </div>
    </>
  );
}
