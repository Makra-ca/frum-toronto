"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import Preloader from "@/components/layout/Preloader";
import { PageWrapper } from "@/components/layout/PageWrapper";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");

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
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </PageWrapper>
    </>
  );
}
