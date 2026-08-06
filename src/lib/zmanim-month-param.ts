import { todayInLocation } from "@/lib/zmanim-day";
import { TORONTO_LOCATION, type ZmanimLocation } from "@/lib/zmanim-location";

export interface MonthRange {
  from: Date; // first of the month, noon UTC
  to: Date; // last of the month, noon UTC
  year: number;
  month: number; // 1-12
}

function monthRange(year: number, month: number): MonthRange {
  const from = new Date(Date.UTC(year, month - 1, 1, 12));
  // Day 0 of the NEXT month is the last day of this one.
  const to = new Date(Date.UTC(year, month, 0, 12));
  return { from, to, year, month };
}

/**
 * "YYYY-MM" -> that whole calendar month. Anything unparseable, out of range,
 * or absent -> the current month AS OBSERVED IN `location`.
 *
 * Never throws: this drives a public, linkable page, and a stale bookmark must
 * still render something useful.
 */
export function parseMonthParam(
  raw: string | null | undefined,
  location: ZmanimLocation = TORONTO_LOCATION,
): MonthRange {
  const match = /^(\d{4})-(\d{2})$/.exec((raw ?? "").trim());
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year >= 1900 && year <= 2200 && month >= 1 && month <= 12) {
      return monthRange(year, month);
    }
  }

  // NOT new Date() — the server runs UTC on Vercel, so "this month" must be
  // resolved in the viewer's location or it flips a day early near a boundary.
  const today = todayInLocation(location);
  return monthRange(today.getUTCFullYear(), today.getUTCMonth() + 1);
}
