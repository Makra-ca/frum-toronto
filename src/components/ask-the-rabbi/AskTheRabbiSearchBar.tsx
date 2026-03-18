"use client";

import { useRouter } from "next/navigation";
import { UniversalSearch } from "@/components/search/UniversalSearch";

interface AskTheRabbiSearchBarProps {
  initialQuery?: string;
}

export function AskTheRabbiSearchBar({ initialQuery = "" }: AskTheRabbiSearchBarProps) {
  const router = useRouter();

  return (
    <UniversalSearch
      searchType="ask-the-rabbi"
      placeholder="Search questions..."
      initialQuery={initialQuery}
      onSearch={(q) => {
        if (q) {
          router.push(`/ask-the-rabbi?q=${encodeURIComponent(q)}`);
        } else {
          router.push("/ask-the-rabbi");
        }
      }}
      className="max-w-2xl"
    />
  );
}
