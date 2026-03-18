"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Building2,
  BookOpen,
  Settings,
  Home,
  Landmark,
  MessageSquare,
  Mail,
  CheckCircle,
  Heart,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/shuls", label: "Shuls", icon: Landmark },
  { href: "/admin/businesses", label: "Businesses", icon: Building2 },
  { href: "/admin/programs", label: "Programs", icon: BookOpen },
  { href: "/admin/community", label: "Community", icon: Heart },
  { href: "/admin/approvals", label: "Approvals", icon: CheckCircle },
  { href: "/admin/newsletters", label: "Newsletters", icon: Mail },
  { href: "/admin/contacts", label: "Contact Messages", icon: MessageSquare },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <div className="p-6 border-b border-blue-800">
        <Link href="/admin" className="text-xl font-bold" onClick={onNavigate}>
          <span className="text-white">Frum</span>
          <span className="text-blue-300">Toronto</span>
          <span className="block text-sm font-normal text-blue-300 mt-1">
            Admin Panel
          </span>
        </Link>
      </div>

      <nav className="flex-1 py-4">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
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
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-2 py-2 text-sm text-blue-200 hover:text-white transition-colors"
        >
          <Home className="h-5 w-5" />
          Visit Site
        </a>
      </div>
    </>
  );
}

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-blue-900 text-white min-h-screen flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-blue-900 text-white px-4 py-3 flex items-center justify-between">
        <Link href="/admin" className="text-lg font-bold">
          <span className="text-white">Frum</span>
          <span className="text-blue-300">Toronto</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-blue-800"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </Button>
      </div>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="w-64 p-0 bg-blue-900 text-white border-none"
        >
          <SheetTitle className="sr-only">Admin Navigation</SheetTitle>
          <SidebarContent onNavigate={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:ml-0">
        {/* Spacer for mobile header */}
        <div className="h-14 md:hidden" />
        {children}
      </div>
    </div>
  );
}
