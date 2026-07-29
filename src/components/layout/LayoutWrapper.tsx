"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import Preloader from "@/components/layout/Preloader";
import { PageWrapper } from "@/components/layout/PageWrapper";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");

  // The header is `fixed`, so it no longer occupies space in the flow. The
  // homepage wants exactly that — its hero runs to the top and the nav floats on
  // it, with the hero's own `underFixedNav` padding providing the clearance.
  // Every other route has no such hero, so it gets a spacer the height of the bar
  // (py-2 + a 48px logo + the 12px top offset) instead of its first element
  // sliding underneath.
  //
  // These two must stay in step: if page.tsx ever renders a hero WITHOUT
  // `underFixedNav`, this has to become `false` or the nav will cover it.
  const heroRunsUnderHeader = pathname === "/";

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
