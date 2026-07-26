// src/lib/zmanim-day.ts
//
// Calendar-day resolution for zmanim.
//
// hebcal decides which civil day a `Date` refers to by reading that Date's
// **local** components — `HDate` documents "using local time… hours, minutes,
// seconds and milliseconds are ignored", the `Zmanim` constructor builds a
// PlainDate from getFullYear/getMonth/getDate, and HebrewCalendar.calendar()
// resolves start/end the same way. Nothing reads the instant.
//
// So the invariant every consumer needs is:
//
//     the Date's server-local Y/M/D equals the intended civil day
//
// Anchoring at 12:00 UTC satisfies that for any server offset in [-12, +12):
// 12:00 ± offset never crosses midnight. Midnight anchoring would not — any
// negative offset flips the day.
//
// LIMITATION: at exactly UTC+12 (Auckland standard time, Fiji, Kamchatka) noon
// UTC is already 00:00 the following day, so the invariant fails on a server at
// that offset. This constrains the SERVER's offset, not the viewer's location:
// a UTC server rendering Auckland zmanim is fine. Production runs on UTC.
//
// Two distinct meanings are kept deliberately separate, because collapsing them
// is what caused the original bug:
//
//   todayInLocation()    "today, wherever the viewer's location is" — an
//                        instant, which must be converted to that location's
//                        civil day.
//   anchorCalendarDate() "the specific date the caller picked" — a calendar
//                        day, which must NOT be shifted by any conversion.

import { type ZmanimLocation } from "./zmanim-location";

export interface CivilDate {
  year: number;
  /** 1-12, not the 0-11 that Date uses. */
  month: number;
  day: number;
}

const MS_PER_DAY = 86_400_000;

/** The civil calendar date at `instant` as observed in `tzid`. */
export function civilDateInTimeZone(instant: Date, tzid: string): CivilDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tzid,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const part = (type: "year" | "month" | "day"): number => {
    const found = parts.find((p) => p.type === type);
    if (!found) throw new Error(`[ZMANIM-DAY] missing ${type} for tzid ${tzid}`);
    return Number(found.value);
  };

  return { year: part("year"), month: part("month"), day: part("day") };
}

/** A Date anchored at exactly 12:00:00.000 UTC on the given civil date. */
export function anchorCivilDate(civil: CivilDate): Date {
  return new Date(Date.UTC(civil.year, civil.month - 1, civil.day, 12, 0, 0, 0));
}

/**
 * Meaning 1 — "today" in the location.
 * Converts an instant to the location's civil day, then anchors it.
 */
export function todayInLocation(
  location: ZmanimLocation,
  now: Date = new Date(),
): Date {
  return anchorCivilDate(civilDateInTimeZone(now, location.tzid));
}

/**
 * Meaning 2 — an explicit calendar date, re-anchored without shifting the day.
 *
 * Reads the server-local Y/M/D of `date`. Safe for any Date whose server-local
 * Y/M/D already denotes the intended civil day — which covers both
 * local-component construction (`new Date(2026, 7, 1)`) and noon-UTC instants
 * (`new Date('2026-08-01T12:00:00Z')`, the form used by the test fixtures).
 */
export function anchorCalendarDate(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0),
  );
}

/**
 * Advance an anchored date by whole days.
 *
 * UTC has no DST, so adding exact 24h multiples to a noon-UTC anchor always
 * lands on noon UTC of the intended day. `setDate()` would instead preserve
 * local wall time and drift the instant by an hour across a DST transition
 * (12:00Z -> 13:00Z); harmless today because hebcal ignores time-of-day, but it
 * erodes the safety margin that keeps the local-component read on the right day.
 */
export function addAnchoredDays(anchor: Date, days: number): Date {
  return new Date(anchor.getTime() + days * MS_PER_DAY);
}
