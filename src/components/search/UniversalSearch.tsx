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
  /**
   * Field styling. "light" — the solid white field, correct on the light page
   * backgrounds the other nine call sites use. "onDark" — a translucent glass
   * field for the hero, where a solid white slab is the brightest thing on a
   * dark photograph and fights the headline for attention.
   *
   * Only the field changes. The suggestions dropdown stays light in both tones:
   * it overlays page content rather than the hero backdrop, and its rows carry
   * their own light-background type badges.
   */
  tone?: "light" | "onDark";
}

// Field styling per tone, kept together so the input, the leading icon and the
// clear button can never drift apart.
const TONE = {
  light: {
    input:
      "bg-white text-gray-900 border-0 shadow-lg focus-visible:ring-2 focus-visible:ring-blue-400",
    icon: "text-gray-400",
    clearHover: "hover:bg-gray-100",
    clearIcon: "text-gray-400",
  },
  onDark: {
    // 12% white over the hero reads as glass rather than a panel. The border is
    // what keeps the pill's edge legible once the fill is this quiet, and
    // backdrop-blur stops the background gradient from muddying typed text.
    input:
      "bg-white/12 text-white border border-white/25 shadow-none backdrop-blur-md placeholder:text-white/70 focus-visible:ring-2 focus-visible:ring-sky-300/60 focus-visible:border-white/40 hover:bg-white/16 transition-colors",
    icon: "text-white/70",
    clearHover: "hover:bg-white/15",
    clearIcon: "text-white/80",
  },
} as const;

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
  blog: { label: "Blog", color: "bg-indigo-100 text-indigo-700" },
  simchas: { label: "Simcha", color: "bg-fuchsia-100 text-fuchsia-700" },
  "kosher-alerts": { label: "Kosher Alert", color: "bg-red-100 text-red-700" },
};

export function UniversalSearch({
  searchType,
  placeholder = "Search...",
  onSearch,
  className = "",
  minChars,
  maxSuggestions = 8,
  initialQuery = "",
  tone = "light",
}: UniversalSearchProps) {
  const toneStyles = TONE[tone];
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

  /**
   * The query currently reflected in the URL, as far as this component knows.
   *
   * Needed because the input used to seed from `initialQuery` on mount only, so
   * after navigating it could keep displaying a query that was no longer applied
   * — e.g. clicking a type filter that drops `?search=` left the box reading the
   * old text while the list showed everything.
   *
   * The ref (rather than comparing against `initialQuery` directly) is what stops
   * the sync from eating keystrokes: it distinguishes a navigation this component
   * caused from an external one. Every current caller derives `initialQuery` from
   * the URL and only navigates on submit, so this is belt-and-braces — but a
   * future caller that pushes on a debounce would otherwise hit exactly the bug
   * that UserFilters had.
   */
  const appliedQueryRef = useRef(initialQuery);

  useEffect(() => {
    if (initialQuery === appliedQueryRef.current) return;
    appliedQueryRef.current = initialQuery;
    setQuery(initialQuery);
    setSuggestions([]);
    setIsOpen(false);
    setSelectedIndex(-1);
  }, [initialQuery]);

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
    const trimmed = query.trim();
    if (trimmed) {
      appliedQueryRef.current = trimmed;
      onSearch?.(trimmed);
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
    appliedQueryRef.current = "";
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
        {/* z-10 is load-bearing: `backdrop-blur` on the onDark input makes it a
            stacking context, and this icon precedes the input in DOM order, so
            without a z-index the glass paints over the icon and smears it to
            near-invisible. The controls on the right come after the input and
            never had the problem. */}
        <Search
          className={`absolute left-4 top-1/2 z-10 -translate-y-1/2 h-5 w-5 pointer-events-none ${toneStyles.icon}`}
        />
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
          className={`pl-12 pr-20 h-14 text-base rounded-xl ${toneStyles.input}`}
          autoComplete="off"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && (
            <Loader2 className={`h-5 w-5 animate-spin ${toneStyles.icon}`} />
          )}
          {query && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className={`p-1.5 rounded-full transition-colors ${toneStyles.clearHover}`}
            >
              <X className={`h-4 w-4 ${toneStyles.clearIcon}`} />
            </button>
          )}
        </div>
      </div>

      {/* Typing alone does not filter anything — the parent only reacts to
          onSearch — so say so when the box no longer matches what is applied. */}
      {onSearch && query.trim() !== "" && query.trim() !== initialQuery.trim() && !isOpen && (
        <p
          className={`mt-2 text-xs ${
            tone === "onDark" ? "text-white/70" : "text-gray-500"
          }`}
        >
          Press Enter to search
        </p>
      )}

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
