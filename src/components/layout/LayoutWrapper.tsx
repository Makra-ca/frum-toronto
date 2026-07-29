"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import Preloader from "@/components/layout/Preloader";
import { PageWrapper } from "@/components/layout/PageWrapper";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");

  // The header is `fixed`, so it no longer occupies space in the flow. A hero
  // designed for it runs to the top of the page and lets the nav float on top;
  // every other route needs a spacer the height of the bar (py-2 + a 48px logo +
  // the 12px top offset) so its first element does not slide underneath.
  //
  // CURRENTLY NO ROUTE OPTS OUT. The homepage is temporarily rendering
  // OriginalHero while the client reviews the redesigns at /comparison-hero, and
  // that component predates the floating nav — it has no top padding, so without
  // the spacer the nav covers its first 25px.
  //
  // When a redesigned hero goes live in src/app/page.tsx (HeroSection or
  // PhotoHero, both of which carry their own top padding), change this back to:
  //   const heroRunsUnderHeader = pathname === "/";
  const heroRunsUnderHeader = false;
  void pathname;

  // Admin routes have their own layout - don't show Header/Footer or Preloader
  if (isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <Preloader />
      <PageWrapper>
        <div className="flex min-h-screen flex-col">
          <Header />
          {!heroRunsUnderHeader && <div aria-hidden className="h-[78px]" />}
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </PageWrapper>
    </>
  );
}
