"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { UniversalSearch } from "@/components/search/UniversalSearch";

interface KosherAlertsSearchBarProps {
  initialQuery?: string;
}

/**
 * Search box for /kosher-alerts.
 *
 * Filtering runs on the server: there are ~1,590 alerts and the page is
 * force-dynamic, so fetching them all to filter in the browser would repeat the
 * mistake that made this page take 46 seconds after the legacy import.
 */
export function KosherAlertsSearchBar({ initialQuery = "" }: KosherAlertsSearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const go = (q: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("search", q);
    else params.delete("search");
    // A new query invalidates the page number.
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/kosher-alerts?${qs}` : "/kosher-alerts");
  };

  return (
    <UniversalSearch
      searchType="kosher-alerts"
      placeholder="Search by product, brand or agency…"
      initialQuery={initialQuery}
      onSearch={go}
      tone="onDark"
      className="max-w-2xl"
    />
  );
}
