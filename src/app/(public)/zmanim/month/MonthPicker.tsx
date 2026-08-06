"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocationPicker } from "@/components/zmanim/LocationPicker";
import { useStoredZmanimLocation } from "@/hooks/useStoredZmanimLocation";
import {
  buildZmanimParams,
  isTorontoLocation,
  type ZmanimLocation,
} from "@/lib/zmanim-location";
import type { MonthRange } from "@/lib/zmanim-month-param";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "YYYY-MM". Zero-padded, because parseMonthParam only accepts two digits. */
function monthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * The sheet's URL. Toronto is the default in parseLocationParamsOrToronto, so
 * its params are omitted — a shared link for the default location stays short
 * and does not pin coordinates that may later be refined.
 */
function sheetHref(year: number, month: number, location: ZmanimLocation): string {
  const params = isTorontoLocation(location)
    ? new URLSearchParams()
    : buildZmanimParams(location);
  params.set("month", monthParam(year, month));
  return `/zmanim/month?${params.toString()}`;
}

/** Step one calendar month, rolling the year. Presentation-level, not zmanim. */
function step(year: number, month: number, delta: number): { year: number; month: number } {
  const zeroBased = month - 1 + delta;
  return {
    year: year + Math.floor(zeroBased / 12),
    month: ((zeroBased % 12) + 12) % 12 + 1,
  };
}

export function MonthPicker({
  range,
  location,
}: {
  range: MonthRange;
  location: ZmanimLocation;
}) {
  const router = useRouter();
  const [storedLocation, setStoredLocation, isHydrated] = useStoredZmanimLocation();

  // Draft state for the two inputs, so a half-typed year never navigates.
  const [month, setMonth] = useState(range.month);
  const [year, setYear] = useState(String(range.year));

  // The server resolved the month from the URL; if the URL changes underneath
  // us (back button, a ‹ / › click) the inputs must follow it.
  useEffect(() => {
    setMonth(range.month);
    setYear(String(range.year));
  }, [range.month, range.year]);

  // The location lives in localStorage so it carries across pages, but this is a
  // server-rendered sheet: it can only honour what is in the URL. On first load
  // of a bare /zmanim/month, adopt the stored location by putting it in the URL.
  // Guarded by a ref so this runs at most once — after the push the URL carries
  // lat/lon and `location` matches, so there is no loop either way.
  const adoptedRef = useRef(false);
  useEffect(() => {
    if (adoptedRef.current || !isHydrated) return;
    adoptedRef.current = true;
    if (isTorontoLocation(storedLocation) || !isTorontoLocation(location)) return;
    router.replace(sheetHref(range.year, range.month, storedLocation));
  }, [isHydrated, storedLocation, location, range.year, range.month, router]);

  const go = (y: number, m: number) => router.push(sheetHref(y, m, location));

  const handleGo = (e: React.FormEvent) => {
    e.preventDefault();
    const y = Number(year);
    // parseMonthParam clamps to 1900-2200 anyway; refusing here avoids a
    // navigation that would silently bounce back to the current month.
    if (!Number.isInteger(y) || y < 1900 || y > 2200) return;
    go(y, month);
  };

  const handleLocationChange = (loc: ZmanimLocation) => {
    setStoredLocation(loc);
    router.push(sheetHref(range.year, range.month, loc));
  };

  const prev = step(range.year, range.month, -1);
  const next = step(range.year, range.month, 1);

  return (
    <div className="no-print mb-6 space-y-3">
      <form onSubmit={handleGo} className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => go(prev.year, prev.month)}
          aria-label="Previous month"
          title="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <label className="sr-only" htmlFor="sheet-month">
          Month
        </label>
        <select
          id="sheet-month"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {MONTHS.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="sheet-year">
          Year
        </label>
        <input
          id="sheet-year"
          type="number"
          inputMode="numeric"
          min={1900}
          max={2200}
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="h-9 w-24 rounded-lg border border-gray-300 bg-white px-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <Button type="submit" variant="outline" size="sm">
          Go
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => go(next.year, next.month)}
          aria-label="Next month"
          title="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          className="ml-auto"
        >
          <Printer className="mr-1 h-4 w-4" />
          Print
        </Button>
      </form>

      <LocationPicker value={location} onChange={handleLocationChange} compact />
    </div>
  );
}
