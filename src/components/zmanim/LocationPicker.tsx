"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Search, X, Loader2, RotateCcw } from "lucide-react";
import tzlookup from "tz-lookup";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchPlaces, reverseGeocode, type GeocodeResult } from "@/lib/geocode";
import {
  type ZmanimLocation,
  TORONTO_LOCATION,
  isIsraelCountry,
} from "@/lib/zmanim-location";

interface LocationPickerProps {
  value: ZmanimLocation;
  onChange: (loc: ZmanimLocation) => void;
  compact?: boolean;
}

function isToronto(loc: ZmanimLocation): boolean {
  return (
    loc.label === TORONTO_LOCATION.label ||
    (loc.lat === TORONTO_LOCATION.lat && loc.lon === TORONTO_LOCATION.lon)
  );
}

export function LocationPicker({
  value,
  onChange,
  compact = false,
}: LocationPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // In compact mode the search UI starts collapsed; in full mode it's always shown.
  const [expanded, setExpanded] = useState(!compact);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const showSearchUI = !compact || expanded;
  const notToronto = !isToronto(value);

  const fetchResults = useCallback(async (q: string) => {
    // Cancel any in-flight request first, so shrinking below the min length
    // also cancels a prior 2+char search that could otherwise repopulate.
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    if (q.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setIsSearching(true);
    try {
      const places = await searchPlaces(q, controller.signal);
      setResults(places);
      setIsOpen(true);
      setSelectedIndex(-1);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("[LocationPicker] search failed:", err);
        setResults([]);
        setError("Couldn't search places, try again");
        setIsOpen(true);
      }
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setError(null);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      fetchResults(val);
    }, 300);
  };

  const handleSelect = (result: GeocodeResult) => {
    let tzid: string;
    try {
      tzid = tzlookup(result.lat, result.lon);
    } catch {
      setError("Couldn't determine the timezone for that place.");
      return;
    }

    onChange({
      lat: result.lat,
      lon: result.lon,
      tzid,
      label: result.label,
      isIsrael: isIsraelCountry(result.countryCode),
    });

    setQuery("");
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    setError(null);
    if (compact) setExpanded(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleUseMyLocation = () => {
    setError(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location isn't available in this browser.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (!mountedRef.current) return;
        const { latitude, longitude } = pos.coords;

        let tzid: string;
        try {
          tzid = tzlookup(latitude, longitude);
        } catch {
          setIsLocating(false);
          setError("Couldn't determine the timezone for your location.");
          return;
        }

        let label = "My location";
        let countryCode = "";
        try {
          const geo = await reverseGeocode(latitude, longitude);
          if (geo) {
            if (geo.label.trim()) label = geo.label;
            countryCode = geo.countryCode;
          }
        } catch (err) {
          console.error("[LocationPicker] reverse geocode failed:", err);
          // Keep the generic label; coordinates + tzid are still valid.
        }

        if (!mountedRef.current) return;

        onChange({
          lat: latitude,
          lon: longitude,
          tzid,
          label,
          isIsrael: isIsraelCountry(countryCode),
        });

        setIsLocating(false);
        setQuery("");
        setResults([]);
        setIsOpen(false);
        if (compact) setExpanded(false);
      },
      () => {
        if (!mountedRef.current) return;
        setIsLocating(false);
        setError("Couldn't get your location.");
      }
    );
  };

  const handleReset = () => {
    onChange(TORONTO_LOCATION);
    setError(null);
    setQuery("");
    setResults([]);
    setIsOpen(false);
    if (compact) setExpanded(false);
  };

  // Click outside closes the dropdown
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

  // Cleanup timers/requests on unmount.
  // Set mountedRef true on (re)mount so React Strict Mode's setup→cleanup→setup
  // in dev doesn't leave it stuck false (which would make the GPS guard bail).
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Active location + controls */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
          <MapPin className="h-4 w-4 text-blue-600" />
          {value.label}
        </span>

        {compact && !expanded && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-blue-600 hover:text-blue-700"
            onClick={() => {
              setExpanded(true);
              setError(null);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
          >
            Change location
          </Button>
        )}

        {notToronto && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-gray-600 hover:text-gray-900"
            onClick={handleReset}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Back to Toronto
          </Button>
        )}
      </div>

      {/* Search UI */}
      {showSearchUI && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <Input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (results.length > 0) setIsOpen(true);
                }}
                placeholder="Search for a city or place..."
                className="pl-9 pr-9"
                autoComplete="off"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                {isSearching && (
                  <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                )}
                {query && !isSearching && (
                  <button
                    type="button"
                    onClick={() => {
                      if (debounceRef.current) clearTimeout(debounceRef.current);
                      abortRef.current?.abort();
                      abortRef.current = null;
                      setQuery("");
                      setResults([]);
                      setIsOpen(false);
                      setIsSearching(false);
                      inputRef.current?.focus();
                    }}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                )}
              </div>

              {/* Dropdown */}
              {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-2xl border border-gray-100 overflow-hidden z-50">
                  {results.length > 0 ? (
                    <div className="py-1 max-h-72 overflow-y-auto">
                      {results.map((result, index) => (
                        <button
                          key={`${result.lat},${result.lon}-${index}`}
                          type="button"
                          onClick={() => handleSelect(result)}
                          onMouseEnter={() => setSelectedIndex(index)}
                          className={`w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2 ${
                            selectedIndex === index
                              ? "bg-blue-50 text-blue-900"
                              : "text-gray-900 hover:bg-gray-50"
                          }`}
                        >
                          <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                          <span className="truncate">{result.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    !isSearching &&
                    query.trim().length >= 2 && (
                      <div className="px-3 py-4 text-center text-sm text-gray-500">
                        No places found
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={handleUseMyLocation}
              disabled={isLocating}
              className="shrink-0"
            >
              {isLocating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <MapPin className="h-4 w-4 mr-1" />
              )}
              Use my location
            </Button>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
