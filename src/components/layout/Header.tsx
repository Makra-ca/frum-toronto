"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, ChevronDown, ChevronLeft, ChevronRight, Search, User } from "lucide-react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mainNavigation } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";
import { DirectoryMegaMenu } from "./DirectoryMegaMenu";
import { DirectoryMobileDrilldown } from "./DirectoryMobileDrilldown";
import { ClassifiedsMegaMenu } from "./ClassifiedsMegaMenu";
import { ClassifiedsMobileDrilldown } from "./ClassifiedsMobileDrilldown";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showDirectoryDrilldown, setShowDirectoryDrilldown] = useState(false);
  const [showClassifiedsDrilldown, setShowClassifiedsDrilldown] = useState(false);

  // Reset drill-down state when menu closes
  useEffect(() => {
    if (!mobileMenuOpen) {
      setShowDirectoryDrilldown(false);
      setShowClassifiedsDrilldown(false);
    }
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white">
      {/* Top bar */}
      <div className="bg-blue-900 text-white py-1 px-4">
        <div className="container mx-auto flex justify-between items-center text-sm">
          <span className="hidden md:block">
            The Toronto Jewish Orthodox Community Gateway
          </span>
          <div className="flex items-center gap-4 ml-auto">
            <Link href="/login" className="hover:underline">
              Login
            </Link>
            <span>|</span>
            <Link href="/register" className="hover:underline">
              Register
            </Link>
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-blue-900">Frum</span>
            <span className="text-2xl font-bold text-blue-600">Toronto</span>
          </Link>

          {/* Desktop Navigation */}
          <NavigationMenu className="hidden lg:flex" viewport={false}>
            <NavigationMenuList>
              {mainNavigation.map((item) => (
                <NavigationMenuItem key={item.label}>
                  {/* Special handling for Directory - use mega menu */}
                  {item.label === "Directory" ? (
                    <>
                      <NavigationMenuTrigger className="text-sm">
                        {item.label}
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <DirectoryMegaMenu />
                      </NavigationMenuContent>
                    </>
                  ) : item.label === "Classifieds" ? (
                    <>
                      <NavigationMenuTrigger className="text-sm">
                        {item.label}
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <ClassifiedsMegaMenu />
                      </NavigationMenuContent>
                    </>
                  ) : item.children ? (
                    <>
                      <NavigationMenuTrigger className="text-sm">
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
                      className="group inline-flex h-10 w-max items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-50 hover:text-blue-900"
                    >
                      {item.label}
                    </Link>
                  )}
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {/* Search button */}
            <Button variant="ghost" size="icon" className="hidden md:flex">
              <Search className="h-5 w-5" />
            </Button>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="hidden md:flex">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/login">Login</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/register">Register</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
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
                    <DirectoryMobileDrilldown onClose={() => setMobileMenuOpen(false)} />
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
                    <ClassifiedsMobileDrilldown onClose={() => setMobileMenuOpen(false)} />
                  </div>
                ) : (
                  <nav className="flex flex-col gap-4 mt-8 px-6">
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
