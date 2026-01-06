"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  FolderTree,
  FileText,
  Calendar,
  BookOpen,
  Settings,
  Home,
  Landmark,
  ClipboardList,
  UserCog,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/businesses", label: "Businesses", icon: Building2 },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/shuls", label: "Shuls", icon: Landmark },
  { href: "/admin/shul-requests", label: "Shul Requests", icon: ClipboardList },
  { href: "/admin/user-shuls", label: "Shul Managers", icon: UserCog },
  { href: "/admin/content", label: "Content", icon: FileText },
  { href: "/admin/contacts", label: "Contact Messages", icon: MessageSquare },
  { href: "/admin/events", label: "Events", icon: Calendar },
  { href: "/admin/shiurim", label: "Shiurim", icon: BookOpen },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-blue-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-blue-800">
        <Link href="/admin" className="text-xl font-bold">
          <span className="text-white">Frum</span>
          <span className="text-blue-300">Toronto</span>
          <span className="block text-sm font-normal text-blue-300 mt-1">
            Admin Panel
          </span>
        </Link>
      </div>

      <nav className="flex-1 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-6 py-3 text-sm transition-colors",
                isActive
                  ? "bg-blue-800 border-r-4 border-white font-medium"
                  : "hover:bg-blue-800/50 text-blue-100"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-blue-800">
        <Link
          href="/"
          className="flex items-center gap-3 px-2 py-2 text-sm text-blue-200 hover:text-white transition-colors"
        >
          <Home className="h-5 w-5" />
          Back to Site
        </Link>
      </div>
    </aside>
  );
}
