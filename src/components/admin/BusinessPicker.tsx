"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface PickableBusiness {
  id: number;
  name: string;
  slug?: string | null;
  city?: string | null;
}

interface BusinessPickerProps {
  value: PickableBusiness | null;
  onChange: (business: PickableBusiness | null) => void;
  placeholder?: string;
  id?: string;
  maxSuggestions?: number;
}

const DEBOUNCE_MS = 300; // matches UserPicker and UniversalSearch

/**
 * Type-to-search business picker, built on the same pattern as UserPicker:
 * debounced query, AbortController so a slow earlier response cannot overwrite a
 * newer one, keyboard navigation and click-outside dismissal.
 *
 * A plain <Select> is not an option — there are ~1,633 businesses, and
 * /api/admin/businesses is paginated, so rendering every row would only ever
 * have listed the first page anyway.
 *
 * As in UserPicker, the query text is local state and is never fed back from the
 * parent mid-typing: echoing an external value into a controlled input is what
 * makes characters disappear while someone is typing.
 */
export function BusinessPicker({
  value,
  onChange,
  placeholder = "Search businesses by name…",
  id,
  maxSuggestions = 8,
}: BusinessPickerProps) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<PickableBusiness[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const listboxId = `${id ?? "business-picker"}-listbox`;

  const fetchBusinesses = useCallback(
    async (search: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          limit: String(maxSuggestions),
          status: "all",
        });
        if (search.trim()) params.set("search", search.trim());

        const res = await fetch(`/api/admin/businesses?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);

        const payload = await res.json();
        setResults(payload.data ?? []);
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (error: unknown) {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("Error loading businesses:", error);
          setResults([]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [maxSuggestions]
  );

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);

    // Editing the text invalidates the selection, or the form could submit a
    // stale business id while the field shows something else.
    if (value) onChange(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchBusinesses(event.target.value), DEBOUNCE_MS);
  };

  const handleSelect = (business: PickableBusiness) => {
    onChange(business);
    setQuery(business.name);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown" && !isOpen) {
      event.preventDefault();
      fetchBusinesses(query);
      return;
    }
    if (!isOpen) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setSelectedIndex((p) => (p < results.length - 1 ? p + 1 : p));
        break;
      case "ArrowUp":
        event.preventDefault();
        setSelectedIndex((p) => (p > 0 ? p - 1 : -1));
        break;
      case "Enter":
        // Only intercept Enter when a row is highlighted, so it never swallows
        // the dialog's own submit.
        if (selectedIndex >= 0 && results[selectedIndex]) {
          event.preventDefault();
          handleSelect(results[selectedIndex]);
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
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    onChange(null);
    inputRef.current?.focus();
  };

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          ref={inputRef}
          id={id}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="pl-9 pr-9"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
        />
        {isLoading ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
        ) : (
          query && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear business"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )
        )}
      </div>

      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-white py-1 shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">No businesses found</li>
          ) : (
            results.map((business, index) => (
              <li key={business.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === selectedIndex}
                  onClick={() => handleSelect(business)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full px-3 py-2 text-left text-sm ${
                    index === selectedIndex ? "bg-blue-50 text-blue-900" : "hover:bg-gray-50"
                  }`}
                >
                  <span className="font-medium">{business.name}</span>
                  {business.city && (
                    <span className="ml-2 text-xs text-gray-500">{business.city}</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
