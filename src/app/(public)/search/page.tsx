"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Building2, Tag, HelpCircle, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SearchResult {
  id: number;
  type: "business" | "classified" | "askTheRabbi";
  title: string;
  description: string | null;
  url: string;
  category?: string | null;
  relevanceScore: number;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

const typeConfig = {
  business: {
    label: "Business",
    icon: Building2,
    color: "bg-blue-100 text-blue-700",
  },
  classified: {
    label: "Classified",
    icon: Tag,
    color: "bg-green-100 text-green-700",
  },
  askTheRabbi: {
    label: "Ask the Rabbi",
    icon: HelpCircle,
    color: "bg-purple-100 text-purple-700",
  },
};

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const LIMIT = 20;

  // Search function
  const performSearch = async (searchQuery: string, searchOffset: number = 0, append: boolean = false) => {
    if (searchQuery.length < 3) {
      if (!append) {
        setResults([]);
        setTotal(0);
      }
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}&limit=${LIMIT}&offset=${searchOffset}`
      );
      const data: SearchResponse = await res.json();

      if (append) {
        setResults((prev) => [...prev, ...data.results]);
      } else {
        setResults(data.results);
      }
      setTotal(data.total);
      setHasMore(data.pagination.hasMore);
      setOffset(searchOffset);
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
  }, [initialQuery]);

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length >= 3) {
      // Update URL
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      performSearch(query.trim());
    }
  };

  // Load more results
  const loadMore = () => {
    performSearch(query, offset + LIMIT, true);
  };

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

          {/* Search Form */}
          <form onSubmit={handleSubmit} className="max-w-2xl">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  type="search"
                  placeholder="Search businesses, classifieds, Ask the Rabbi..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-10 h-12 bg-white text-slate-900 border-0"
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="bg-white text-blue-600 hover:bg-blue-50 h-12 px-8"
                disabled={query.length < 3}
              >
                Search
              </Button>
            </div>
            {query.length > 0 && query.length < 3 && (
              <p className="text-blue-200 text-sm mt-2">
                Please enter at least 3 characters
              </p>
            )}
          </form>
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
              {total === 0 ? (
                <>No results found for &quot;{initialQuery}&quot;</>
              ) : (
                <>
                  Found <span className="font-semibold">{total}</span> result
                  {total !== 1 && "s"} for &quot;{initialQuery}&quot;
                </>
              )}
            </p>

            {results.length > 0 && (
              <div className="space-y-4">
                {results.map((result) => {
                  const config = typeConfig[result.type];
                  const Icon = config.icon;

                  return (
                    <Link
                      key={`${result.type}-${result.id}`}
                      href={result.url}
                      className="block bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md hover:border-blue-300 transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`p-2 rounded-lg ${config.color}`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded ${config.color}`}
                            >
                              {config.label}
                            </span>
                            {result.category && (
                              <span className="text-xs text-slate-500">
                                {result.category}
                              </span>
                            )}
                          </div>
                          <h3 className="font-semibold text-slate-900 mb-1">
                            {result.title}
                          </h3>
                          {result.description && (
                            <p className="text-sm text-slate-600 line-clamp-2">
                              {result.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center mt-8">
                <Button
                  onClick={loadMore}
                  variant="outline"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load More Results"
                  )}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-slate-500">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Enter a search term to find businesses, classifieds, and more.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Loading fallback for Suspense
function SearchLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold mb-6">Search</h1>
          <div className="max-w-2xl h-12 bg-white/20 rounded animate-pulse" />
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
