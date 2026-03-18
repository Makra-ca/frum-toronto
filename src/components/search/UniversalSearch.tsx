"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { SearchSuggestion, SearchType } from "@/lib/search/types";

interface UniversalSearchProps {
  searchType: SearchType;
  placeholder?: string;
  onSearch?: (query: string) => void;
  className?: string;
  minChars?: number;
  maxSuggestions?: number;
  initialQuery?: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  businesses: { label: "Business", color: "bg-blue-100 text-blue-700" },
  classifieds: { label: "Classified", color: "bg-green-100 text-green-700" },
  shuls: { label: "Shul", color: "bg-amber-100 text-amber-700" },
  shiurim: { label: "Shiur", color: "bg-teal-100 text-teal-700" },
  events: { label: "Event", color: "bg-pink-100 text-pink-700" },
  "ask-the-rabbi": {
    label: "Ask the Rabbi",
    color: "bg-purple-100 text-purple-700",
  },
};

export function UniversalSearch({
  searchType,
  placeholder = "Search...",
  onSearch,
  className = "",
  minChars,
  maxSuggestions = 8,
  initialQuery = "",
}: UniversalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const effectiveMinChars = minChars ?? (searchType === "all" ? 3 : 2);

  const fetchSuggestions = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < effectiveMinChars) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      // Cancel previous request
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/search/suggestions?type=${searchType}&q=${encodeURIComponent(searchQuery)}&limit=${maxSuggestions}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setIsOpen((data.suggestions?.length ?? 0) > 0);
        setSelectedIndex(-1);
      } catch (error: unknown) {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("Error fetching suggestions:", error);
          setSuggestions([]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [searchType, effectiveMinChars, maxSuggestions]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  };

  const handleSearch = () => {
    if (query.trim()) {
      onSearch?.(query.trim());
    }
    setIsOpen(false);
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    router.push(suggestion.url);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && e.key !== "Enter") return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSuggestionClick(suggestions[selectedIndex]);
        } else {
          handleSearch();
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    onSearch?.("");
    inputRef.current?.focus();
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Highlight matching text (multi-word)
  const highlightMatch = (text: string, q: string) => {
    if (!q.trim()) return text;

    const words = q
      .trim()
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

    if (words.length === 0) return text;

    const regex = new RegExp(`(${words.join("|")})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 text-gray-900 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const showAllMode = searchType === "all";

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="pl-12 pr-20 h-14 bg-white text-gray-900 border-0 text-base rounded-xl shadow-lg focus-visible:ring-2 focus-visible:ring-blue-400"
          autoComplete="off"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && (
            <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
          )}
          {query && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50">
          <div className="py-2">
            {suggestions.map((suggestion, index) => {
              const typeInfo = TYPE_LABELS[suggestion.type];
              return (
                <button
                  key={`${suggestion.type}-${suggestion.id}`}
                  onClick={() => handleSuggestionClick(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    selectedIndex === index ? "bg-blue-50" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {showAllMode && typeInfo && (
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded ${typeInfo.color}`}
                          >
                            {typeInfo.label}
                          </span>
                        )}
                        {suggestion.subtitle && (
                          <span className="text-xs text-gray-500">
                            {suggestion.subtitle}
                          </span>
                        )}
                      </div>
                      <div className="font-medium text-gray-900 text-sm leading-snug">
                        {highlightMatch(suggestion.title, query)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Search all results footer */}
          {onSearch && (
            <button
              onClick={handleSearch}
              className="w-full px-4 py-3 text-left border-t border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 text-blue-600">
                <Search className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Search all results for &quot;{query}&quot;
                </span>
              </div>
            </button>
          )}
        </div>
      )}

      {/* No results */}
      {isOpen &&
        query.length >= effectiveMinChars &&
        suggestions.length === 0 &&
        !isLoading && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50">
            <div className="px-4 py-6 text-center">
              <p className="text-gray-500 text-sm">No results found</p>
              {onSearch && (
                <button
                  onClick={handleSearch}
                  className="mt-2 text-blue-600 text-sm font-medium hover:underline"
                >
                  Search anyway
                </button>
              )}
            </div>
          </div>
        )}
    </div>
  );
}
