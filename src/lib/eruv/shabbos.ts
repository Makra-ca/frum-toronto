/**
 * Which Shabbos an eruv status belongs to.
 *
 * An eruv status is stored against the Shabbos it applies to, not the day it
 * was typed, so a status entered for an earlier Shabbos can never be returned
 * as the current one. That makes this module the single definition of "which
 * Shabbos are we talking about right now".
 */
import { getZmanimForDate } from "@/lib/zmanim";
import { TORONTO_LOCATION, type ZmanimLocation } from "@/lib/zmanim-location";
import { todayInLocation, addAnchoredDays } from "@/lib/zmanim-day";

/** One selectable Shabbos: the stored date plus a human label. */
export interface ShabbosOption {
  /** "2026-08-08" — matches eruv_status.status_date. */
  date: string;
  /** Parsha name, e.g. "Eikev". */
  label: string;
}

const SATURDAY = 6;

/** An anchored (noon UTC) date as the "YYYY-MM-DD" stored in status_date. */
function toDateString(anchored: Date): string {
  return anchored.toISOString().slice(0, 10);
}

/** Re-anchor a "YYYY-MM-DD" back to noon UTC without shifting the day. */
function fromDateString(date: string): Date {
  return new Date(`${date}T12:00:00.000Z`);
}

/** Strict "YYYY-MM-DD". Anything else is not a date we can store. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whether a stored date string denotes a Saturday.
 *
 * A status is looked up by its exact date, so one saved against a Tuesday would
 * be invisible forever — silently. Both admin write paths use this, because a
 * UI that only offers Saturdays is not itself a constraint.
 *
 * Parsed as UTC so it reads as a plain calendar date and cannot shift a day in
 * a server timezone. Returns false rather than throwing on malformed input:
 * reaching the write path, a throw became a 500 where the caller deserves a 400.
 */
export function isShabbosDate(date: string): boolean {
  if (!DATE_PATTERN.test(date)) return false;

  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;

  // Rejects a well-formed but impossible date such as 2026-02-31, which JS
  // would otherwise roll silently forward into March.
  if (parsed.toISOString().slice(0, 10) !== date) return false;

  return parsed.getUTCDay() === SATURDAY;
}

/**
 * The Shabbos currently in effect, as "YYYY-MM-DD".
 *
 * Saturday resolves to ITSELF; every other day resolves to the coming Saturday.
 * Rollover is therefore midnight in `location`, which keeps the just-finished
 * Shabbos visible through Saturday night rather than flipping to a next week
 * that has almost certainly not been checked yet.
 *
 * Deliberately not `getUpcomingShabbat` from @/lib/zmanim: that computes
 * `dayOfWeek <= 5 ? 5 - dayOfWeek : 6`, so on a Saturday it skips to next week.
 * Right for candle lighting, wrong here.
 *
 * The civil day comes from `todayInLocation`, never from server-local date
 * components — on a UTC server (what Vercel runs) a Toronto Friday evening
 * reads as Saturday.
 */
export function currentShabbos(
  now: Date = new Date(),
  location: ZmanimLocation = TORONTO_LOCATION,
): string {
  const today = todayInLocation(location, now);
  const daysUntilSaturday = (SATURDAY - today.getUTCDay()) % 7;
  return toDateString(addAnchoredDays(today, daysUntilSaturday));
}

/**
 * The next `count` Shabbatot starting from the one currently in effect.
 *
 * Starts at the current Shabbos rather than the next one so an admin can still
 * correct today's status on Shabbos itself.
 */
export function listUpcomingShabbatot(
  from: Date = new Date(),
  count: number,
  location: ZmanimLocation = TORONTO_LOCATION,
): ShabbosOption[] {
  const first = fromDateString(currentShabbos(from, location));

  return Array.from({ length: count }, (_, week) => {
    const shabbos = addAnchoredDays(first, week * 7);
    return {
      date: toDateString(shabbos),
      label: getZmanimForDate(shabbos, location).parsha ?? "",
    };
  });
}
