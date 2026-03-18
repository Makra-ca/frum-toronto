"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Building2,
  Tag,
  HelpCircle,
  Loader2,
  ArrowLeft,
  Landmark,
  BookOpen,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UniversalSearch } from "@/components/search/UniversalSearch";
import type { SearchSuggestion } from "@/lib/search/types";

const typeConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  businesses: { label: "Business", icon: Building2, color: "bg-blue-100 text-blue-700" },
  classifieds: { label: "Classified", icon: Tag, color: "bg-green-100 text-green-700" },
  "ask-the-rabbi": { label: "Ask the Rabbi", icon: HelpCircle, color: "bg-purple-100 text-purple-700" },
  shuls: { label: "Shul", icon: Landmark, color: "bg-amber-100 text-amber-700" },
  shiurim: { label: "Shiur", icon: BookOpen, color: "bg-teal-100 text-teal-700" },
  events: { label: "Event", icon: Calendar, color: "bg-pink-100 text-pink-700" },
};

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";

  const [results, setResults] = useState<SearchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const performSearch = async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/search/suggestions?type=all&q=${encodeURIComponent(searchQuery)}&limit=20`
      );
      const data = await res.json();
      setResults(data.suggestions || []);
      setHasSearched(true);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial search on page load
  useEffect(() => {
    if (initialQuery.length >= 3) {
      performSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-12">
        <div className="container mx-auto px-4">
          <Link
            href="/"
            className="inline-flex items-center text-blue-200 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Home
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mb-6">Search</h1>

          <UniversalSearch
            searchType="all"
            placeholder="Search businesses, events, shuls, and more..."
            initialQuery={initialQuery}
            onSearch={(q) => {
              router.push(`/search?q=${encodeURIComponent(q)}`);
              performSearch(q);
            }}
            className="max-w-2xl"
          />
        </div>
      </div>

      {/* Results */}
      <div className="container mx-auto px-4 py-8">
        {isLoading && results.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : hasSearched ? (
          <>
            <p className="text-slate-600 mb-6">
              {results.length === 0 ? (
                <>No results found for &quot;{initialQuery}&quot;</>
              ) : (
                <>
                  Found <span className="font-semibold">{results.length}</span> result
                  {results.length !== 1 && "s"} for &quot;{initialQuery}&quot;
                </>
              )}
            </p>

            {results.length > 0 && (
              <div className="space-y-4">
                {results.map((result) => {
                  const config = typeConfig[result.type] || typeConfig.businesses;
                  const Icon = config.icon;

                  return (
                    <Link
                      key={`${result.type}-${result.id}`}
                      href={result.url}
                      className="block bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md hover:border-blue-300 transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${config.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded ${config.color}`}
                            >
                              {config.label}
                            </span>
                            {result.subtitle && (
                              <span className="text-xs text-slate-500">
                                {result.subtitle}
                              </span>
                            )}
                          </div>
                          <h3 className="font-semibold text-slate-900 mb-1">
                            {result.title}
                          </h3>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-slate-500">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Enter a search term to find businesses, events, shuls, and more.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SearchLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold mb-6">Search</h1>
          <div className="max-w-2xl h-14 bg-white/20 rounded-xl animate-pulse" />
        </div>
      </div>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchLoading />}>
      <SearchPageContent />
    </Suspense>
  );
}
