// Pure. Turns a date range into the exact ordered list of lines the sheet
// renders, so ZmanimSheet.tsx contains no date arithmetic and makes no
// placement decisions.
import { HDate, HebrewCalendar, Zmanim } from "@hebcal/core";
import {
  getZmanimForRange,
  labelsForDate,
  toHebcalLocation,
  type ZmanimResponse,
} from "@/lib/zmanim";
import { dafYomiForDate } from "@/lib/daf-yomi";
import { moladFootnotesInRange } from "@/lib/kiddush-levana";
import { todayInLocation, anchorCalendarDate, addAnchoredDays } from "@/lib/zmanim-day";
import { formatZman } from "@/lib/zmanim-format";
import { TORONTO_LOCATION, type ZmanimLocation } from "@/lib/zmanim-location";

export interface SheetRow {
  kind: "day";
  date: Date;
  hebrewDateShort: string;
  zmanim: ZmanimResponse;
  labels: string[];
  dafYomi: string | null;
  isToday: boolean;
}

export interface FootnoteLine {
  kind: "footnote";
  text: string;
}

export type SheetLine = SheetRow | FootnoteLine;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** "30 Av 5786" -> "30 Av". A luach row shows the day and month, not the year. */
function stripHebrewYear(s: string): string {
  return s.replace(/\s+\d+$/, "");
}

/**
 * Fast start and end for a date, or null.
 *
 * These are NOT among the seventeen columns: "Fast ends" is tzeit(7.083°), and
 * the fast STARTS at Alos 16.1° while the adjacent Alos 72 column sits ~15
 * minutes later — nothing on the sheet would say which applies.
 */
function fastLine(date: Date, location: ZmanimLocation): string | null {
  // Detect WHETHER this is a fast day from hebcal's events, but compute the
  // TIMES ourselves.
  //
  // hebcal's Fast begins/Fast ends eventTime arrives PRE-ROUNDED to :00 seconds,
  // so roundZman would short-circuit and the direction below would never apply.
  // Measured for Tzom Gedaliah 2026-09-14 at Toronto: real tzeit(7.083) =
  // 20:04:23, hebcal's event = 20:04:00 — routing the event through roundZman
  // prints 8:04 PM instead of 8:05 PM, a minute LENIENT on a time that ends a
  // fast, on a sheet pinned to a wall.
  //
  // BOTH `location` and `candlelighting: true` are required for hebcal to emit
  // these at all: location alone emits nothing, and candlelighting without a
  // location THROWS "options.candlelighting requires valid options.location".
  const events = HebrewCalendar.calendar({
    start: date,
    end: date,
    location: toHebcalLocation(location),
    il: location.isIsrael,
    candlelighting: true,
  });

  let hasBegins = false;
  let hasEnds = false;
  for (const ev of events) {
    const d = ev.getDesc();
    if (d === "Fast begins") hasBegins = true;
    if (d === "Fast ends") hasEnds = true;
  }
  if (!hasBegins && !hasEnds) return null;

  const z = new Zmanim(toHebcalLocation(location), date, false);
  const parts: string[] = [];
  // The fast BEGINS as a deadline — stop eating by then — so round DOWN.
  if (hasBegins) parts.push(`Fast begins ${formatZman(z.alotHaShachar(), location.tzid, "down")}`);
  // The fast ENDS as a permitted-from time, so round UP. 7.083 degrees is the
  // shiur hebcal itself uses for this row.
  if (hasEnds) parts.push(`Fast ends ${formatZman(z.tzeit(7.083), location.tzid, "up")}`);
  return parts.join("  ·  ");
}

export function buildSheetLines(
  from: Date,
  to: Date,
  location: ZmanimLocation = TORONTO_LOCATION,
  /** Injectable for tests. Defaults to today IN THE LOCATION, never the server. */
  today: Date = todayInLocation(location),
): SheetLine[] {
  const days = getZmanimForRange(from, to, location);
  const footnotes = moladFootnotesInRange(anchorCalendarDate(from), anchorCalendarDate(to));
  const todayIso = isoDay(anchorCalendarDate(today));

  // Index footnote text by the day it belongs after.
  const byDay = new Map<string, string[]>();
  const push = (d: Date, text: string) => {
    const k = isoDay(d);
    byDay.set(k, [...(byDay.get(k) ?? []), text]);
  };
  for (const f of footnotes) {
    if (f.moladCivilDate >= from && f.moladCivilDate <= to) push(f.moladCivilDate, f.moladLine);
    if (f.sofZmanCivilDate >= from && f.sofZmanCivilDate <= to) push(f.sofZmanCivilDate, f.sofZmanLine);
  }

  const lines: SheetLine[] = [];
  const start = anchorCalendarDate(from);
  for (let i = 0; i < days.length; i++) {
    // addAnchoredDays, not raw millisecond arithmetic — same result today, but
    // the helper is the one place this convention is documented.
    const date = addAnchoredDays(start, i);
    lines.push({
      kind: "day",
      date,
      hebrewDateShort: stripHebrewYear(new HDate(date).toString()),
      zmanim: days[i],
      labels: labelsForDate(date, location),
      dafYomi: dafYomiForDate(date),
      isToday: isoDay(date) === todayIso,
    });

    const fast = fastLine(date, location);
    if (fast) lines.push({ kind: "footnote", text: fast });

    for (const text of byDay.get(isoDay(date)) ?? []) {
      lines.push({ kind: "footnote", text });
    }
  }

  return lines;
}
