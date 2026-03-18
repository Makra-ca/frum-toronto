"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Menu, ChevronDown, ChevronLeft, ChevronRight, LogOut, LayoutDashboard, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mainNavigation } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";
import { DirectoryMegaMenu, DirectoryCategory } from "./DirectoryMegaMenu";
import { DirectoryMobileDrilldown } from "./DirectoryMobileDrilldown";
import { ClassifiedsMegaMenu, ClassifiedsData } from "./ClassifiedsMegaMenu";
import { ClassifiedsMobileDrilldown } from "./ClassifiedsMobileDrilldown";

export function Header() {
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showDirectoryDrilldown, setShowDirectoryDrilldown] = useState(false);
  const [showClassifiedsDrilldown, setShowClassifiedsDrilldown] = useState(false);

  // Prefetched nav data - loaded on mount for instant dropdowns
  const [directoryCategories, setDirectoryCategories] = useState<DirectoryCategory[] | null>(null);
  const [classifiedsData, setClassifiedsData] = useState<ClassifiedsData | null>(null);

  const isAdmin = session?.user?.role === "admin";

  // Prefetch navigation data on mount
  useEffect(() => {
    // Fetch directory categories
    fetch("/api/directory/categories")
      .then((res) => res.json())
      .then((data) => setDirectoryCategories(data))
      .catch(() => {});

    // Fetch classifieds data
    fetch("/api/classifieds/categories")
      .then((res) => res.json())
      .then((data) => setClassifiedsData(data))
      .catch(() => {});
  }, []);

  // Reset drill-down state when menu closes
  useEffect(() => {
    if (!mobileMenuOpen) {
      setShowDirectoryDrilldown(false);
      setShowClassifiedsDrilldown(false);
    }
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <Image
              src="/logo.png"
              alt="FrumToronto"
              width={60}
              height={60}
              className="h-10 sm:h-12 w-auto"
              priority
            />
            <div className="flex items-baseline xl:hidden 2xl:flex">
              <span className="text-xl sm:text-2xl font-bold text-blue-900">Frum</span>
              <span className="text-xl sm:text-2xl font-bold text-blue-600">Toronto</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <NavigationMenu className="hidden xl:flex" viewport={false}>
            <NavigationMenuList>
              {mainNavigation.map((item) => (
                <NavigationMenuItem key={item.label}>
                  {/* Special handling for Directory - use mega menu */}
                  {item.label === "Directory" ? (
                    <>
                      <NavigationMenuTrigger className="text-[13px] px-2.5 2xl:text-sm 2xl:px-4">
                        {item.label}
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <DirectoryMegaMenu categories={directoryCategories} />
                      </NavigationMenuContent>
                    </>
                  ) : item.label === "Classifieds" ? (
                    <>
                      <NavigationMenuTrigger className="text-[13px] px-2.5 2xl:text-sm 2xl:px-4">
                        {item.label}
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <ClassifiedsMegaMenu data={classifiedsData} />
                      </NavigationMenuContent>
                    </>
                  ) : item.children ? (
                    <>
                      <NavigationMenuTrigger className="text-[13px] px-2.5 2xl:text-sm 2xl:px-4">
                        {item.label}
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <ul className="grid w-[200px] gap-1 p-2">
                          {item.children.map((child) => (
                            <li key={child.href}>
                              <NavigationMenuLink asChild>
                                <Link
                                  href={child.href}
                                  className="block select-none rounded-md p-2 text-sm leading-none no-underline outline-none transition-colors hover:bg-blue-50 hover:text-blue-900"
                                >
                                  {child.label}
                                </Link>
                              </NavigationMenuLink>
                            </li>
                          ))}
                        </ul>
                      </NavigationMenuContent>
                    </>
                  ) : (
                    <Link
                      href={item.href}
                      className="group inline-flex h-10 w-max items-center justify-center rounded-md bg-white px-2.5 py-2 text-[13px] font-medium transition-colors hover:bg-blue-50 hover:text-blue-900 2xl:px-4 2xl:text-sm"
                    >
                      {item.label}
                    </Link>
                  )}
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>

          {/* Right side actions */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Auth area - desktop/tablet only */}
            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="hidden md:flex items-center gap-2 rounded-full pl-3 pr-1 py-1 hover:bg-gray-100 transition-colors">
                    <span className="text-sm font-medium text-gray-700 max-w-[120px] truncate">
                      {session.user?.name?.split(" ")[0] || "Account"}
                    </span>
                    <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold">
                      {session.user?.name
                        ? session.user.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)
                        : session.user?.email?.[0]?.toUpperCase() || "U"}
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{session.user?.name}</p>
                    <p className="text-xs text-muted-foreground">{session.user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="cursor-pointer">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="cursor-pointer">
                        <Shield className="mr-2 h-4 w-4" />
                        Admin Panel
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="cursor-pointer text-red-600"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden md:flex items-center gap-1 xl:gap-2">
                <Link
                  href="/login"
                  className="text-[13px] xl:text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors px-2 xl:px-3 py-2"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="text-[13px] xl:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors px-3 xl:px-4 py-2 rounded-lg whitespace-nowrap"
                >
                  Sign up
                </Link>
              </div>
            )}

            {/* Mobile menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="xl:hidden">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px] p-0">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                {showDirectoryDrilldown ? (
                  <div className="flex flex-col h-full">
                    {/* Back to main menu */}
                    <button
                      onClick={() => setShowDirectoryDrilldown(false)}
                      className="flex items-center gap-2 px-4 py-3 text-blue-600 font-medium border-b border-gray-100 bg-white"
                    >
                      <ChevronLeft className="h-5 w-5" />
                      Back to Menu
                    </button>
                    <DirectoryMobileDrilldown onClose={() => setMobileMenuOpen(false)} categories={directoryCategories} />
                  </div>
                ) : showClassifiedsDrilldown ? (
                  <div className="flex flex-col h-full">
                    {/* Back to main menu */}
                    <button
                      onClick={() => setShowClassifiedsDrilldown(false)}
                      className="flex items-center gap-2 px-4 py-3 text-blue-600 font-medium border-b border-gray-100 bg-white"
                    >
                      <ChevronLeft className="h-5 w-5" />
                      Back to Menu
                    </button>
                    <ClassifiedsMobileDrilldown onClose={() => setMobileMenuOpen(false)} data={classifiedsData} />
                  </div>
                ) : (
                  <nav className="flex flex-col gap-4 mt-8 px-6 overflow-y-auto max-h-[calc(100vh-2rem)] pb-8">
                    {mainNavigation.map((item) => (
                      <div key={item.label}>
                        {item.label === "Directory" ? (
                          <button
                            onClick={() => setShowDirectoryDrilldown(true)}
                            className="flex items-center justify-between w-full py-2 text-lg font-medium hover:text-blue-600"
                          >
                            {item.label}
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                          </button>
                        ) : item.label === "Classifieds" ? (
                          <button
                            onClick={() => setShowClassifiedsDrilldown(true)}
                            className="flex items-center justify-between w-full py-2 text-lg font-medium hover:text-blue-600"
                          >
                            {item.label}
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                          </button>
                        ) : item.children ? (
                          <MobileNavItem
                            item={item}
                            onClose={() => setMobileMenuOpen(false)}
                          />
                        ) : (
                          <Link
                            href={item.href}
                            className="block py-2 text-lg font-medium hover:text-blue-600"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {item.label}
                          </Link>
                        )}
                      </div>
                    ))}
                    <div className="border-t pt-4 mt-4">
                      {session ? (
                        <>
                          <div className="py-2 text-sm text-gray-500">
                            Signed in as {session.user?.email}
                          </div>
                          <Link
                            href="/dashboard"
                            className="block py-2 text-lg font-medium hover:text-blue-600"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            Dashboard
                          </Link>
                          {isAdmin && (
                            <Link
                              href="/admin"
                              className="block py-2 text-lg font-medium hover:text-blue-600"
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              Admin Panel
                            </Link>
                          )}
                          <button
                            onClick={() => {
                              setMobileMenuOpen(false);
                              signOut({ callbackUrl: "/" });
                            }}
                            className="block py-2 text-lg font-medium text-red-600 hover:text-red-700"
                          >
                            Sign Out
                          </button>
                        </>
                      ) : (
                        <>
                          <Link
                            href="/login"
                            className="block py-2 text-lg font-medium hover:text-blue-600"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            Login
                          </Link>
                          <Link
                            href="/register"
                            className="block py-2 text-lg font-medium hover:text-blue-600"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            Register
                          </Link>
                        </>
                      )}
                    </div>
                  </nav>
                )}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

function MobileNavItem({
  item,
  onClose,
}: {
  item: (typeof mainNavigation)[0];
  onClose: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button
        className="flex items-center justify-between w-full py-2 text-lg font-medium hover:text-blue-600"
        onClick={() => setIsOpen(!isOpen)}
      >
        {item.label}
        <ChevronDown
          className={cn("h-5 w-5 transition-transform", isOpen && "rotate-180")}
        />
      </button>
      {isOpen && item.children && (
        <div className="pl-4 border-l-2 border-blue-100 ml-2 mt-2">
          {item.children.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              className="block py-2 text-base text-gray-600 hover:text-blue-600"
              onClick={onClose}
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
