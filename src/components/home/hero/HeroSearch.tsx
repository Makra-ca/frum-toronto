"use client";

// src/components/home/hero/HeroSearch.tsx
//
// The search field and its "Popular:" chips. Owns the useRouter call that
// previously forced the whole 527-line hero to be a client component.
//
// The chips are real links, not canned queries: they give a first-time visitor a
// way in without typing, and they are ordinary internal links for crawlers.
// Hidden below `md`, where the destination chips are the more useful of the two
// and two chip rows would just be noise.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { UniversalSearch } from "@/components/search/UniversalSearch";

const POPULAR: Array<{ label: string; href: string }> = [
  { label: "Pizza", href: "/search?q=pizza" },
  { label: "Shabbos minyan", href: "/shuls" },
  { label: "Camp", href: "/search?q=camp" },
  { label: "Sheitel", href: "/search?q=sheitel" },
];

export function HeroSearch() {
  const router = useRouter();

  return (
    <div className="relative z-40 max-w-[460px]">
      <UniversalSearch
        searchType="all"
        placeholder="Search shuls, businesses, events…"
        onSearch={(q) => router.push(`/search?q=${encodeURIComponent(q)}`)}
      />

      <div className="mt-3 hidden flex-wrap items-center gap-2 text-[12.5px] md:flex">
        <span className="text-slate-400">Popular:</span>
        {POPULAR.map((p) => (
          <Link
            key={p.label}
            href={p.href}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-slate-200 transition-colors hover:border-sky-300/50 hover:text-white"
          >
            {p.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
