"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { UniversalSearch } from "@/components/search/UniversalSearch";

interface DirectorySearchBarProps {
  initialQuery?: string;
}

export function DirectorySearchBar({ initialQuery = "" }: DirectorySearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <UniversalSearch
      searchType="businesses"
      placeholder="Search businesses..."
      initialQuery={initialQuery}
      onSearch={(q) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("q", q);
        params.set("page", "1");
        router.push(`/directory/search?${params.toString()}`);
      }}
      className="max-w-2xl"
    />
  );
}
