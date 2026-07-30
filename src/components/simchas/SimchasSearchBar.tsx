"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { UniversalSearch } from "@/components/search/UniversalSearch";

interface SimchasSearchBarProps {
  initialQuery?: string;
}

/**
 * Search box for the /simchas archive.
 *
 * The filtering happens on the server, not in the browser: there are ~16,550
 * announcements, so the useMemo client-side approach taken by /shuls and
 * /shiurim (a few dozen rows each) would mean shipping the whole archive.
 * Submitting writes ?search= and the page re-queries Postgres.
 */
export function SimchasSearchBar({ initialQuery = "" }: SimchasSearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const go = (q: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("search", q);
    else params.delete("search");
    // A new query invalidates the page number.
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/simchas?${qs}` : "/simchas");
  };

  return (
    <UniversalSearch
      searchType="simchas"
      placeholder="Search by family name…"
      initialQuery={initialQuery}
      onSearch={go}
      tone="onDark"
      className="max-w-2xl"
    />
  );
}
