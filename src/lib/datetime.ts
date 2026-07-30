/**
 * Date/time formatting for a Toronto community site.
 *
 * Two kinds of value live in this database and they need opposite treatment:
 *
 *  1. INSTANTS — `timestamp` columns holding a real moment (events.start_time,
 *     created_at, published_at). These must be rendered in Toronto time, or the
 *     same value renders differently depending on where the code runs. Vercel
 *     runs Node in UTC, so a bare `toLocaleString()` in a server component
 *     shows a Toronto reader a time 4-5 hours off, while the same value in a
 *     client component renders correctly. Use `formatInstant`.
 *
 *  2. DATE-ONLY — `date` columns (simchas.event_date, kosher_alerts.effective_date,
 *     tehillim_list.expires_at). These carry no time and no zone: "the simcha is
 *     on June 22" is true in every timezone. Converting them is the bug, not the
 *     fix — `new Date("2027-06-22")` is midnight UTC, which in Toronto is the
 *     21st at 8pm, so a naive conversion moves every one of them back a day.
 *     Use `formatDateOnly`.
 *
 * Note that `expiresAt` is BOTH: it is a `date` on tehillim_list but a
 * `timestamp` on alerts and classifieds. Check the column before choosing.
 */

export const TORONTO_TZ = "America/Toronto";

const DEFAULT_INSTANT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "long",
  day: "numeric",
  year: "numeric",
};

// Deliberately does NOT accept `number`. `Number.prototype.toLocaleString` is a
// different method that happens to share a name with the Date one, so accepting
// numbers here lets `count.toLocaleString()` silently become a 1969 date.
function toDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Format a real moment in time, always in Toronto's timezone.
 *
 * Safe to call from a server component, a client component, or a cron job —
 * the result does not depend on where the code runs.
 */
export function formatInstant(
  value: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = DEFAULT_INSTANT_OPTIONS
): string {
  const d = toDate(value);
  if (!d) return "";
  return d.toLocaleString("en-US", { ...options, timeZone: TORONTO_TZ });
}

/**
 * Format a calendar date that carries no time and no timezone.
 *
 * Accepts "2027-06-22" and the "2027-06-22T00:00:00.000Z" that the API emits
 * for DATE columns. The stored calendar day is preserved exactly — no
 * conversion happens in either direction.
 */
export function formatDateOnly(
  value: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS
): string {
  if (value === null || value === undefined || value === "") return "";

  let year: number, month: number, day: number;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    // Values from a DATE column arrive as midnight UTC; read the UTC parts so
    // the stored calendar day survives regardless of the running timezone.
    year = value.getUTCFullYear();
    month = value.getUTCMonth();
    day = value.getUTCDate();
  } else {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!match) return "";
    year = Number(match[1]);
    month = Number(match[2]) - 1;
    day = Number(match[3]);
  }

  const utc = new Date(Date.UTC(year, month, day, 12, 0, 0));
  if (Number.isNaN(utc.getTime())) return "";
  // Formatted in UTC so the calendar day cannot drift.
  return utc.toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
}

/* -------------------------------------------------------------------------
 * Form inputs
 *
 * `<input type="date">` and `<input type="time">` deal in Toronto wall-clock
 * time. Both halves MUST be derived from — and interpreted in — the same
 * timezone, or a save moves the event. See tests/unit/datetime-inputs.test.ts.
 * ---------------------------------------------------------------------- */

const TORONTO_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: TORONTO_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function torontoParts(date: Date) {
  const parts = TORONTO_PARTS.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    // Intl renders midnight as hour 24 in some ICU versions; normalise it.
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

/** Toronto's UTC offset, in milliseconds, at a given instant. */
function torontoOffsetMs(date: Date): number {
  const p = torontoParts(date);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asIfUtc - date.getTime();
}

/** The `YYYY-MM-DD` Toronto calendar day an instant falls on. */
export function toDateInputValue(
  value: Date | string | null | undefined
): string {
  const d = toDate(value);
  if (!d) return "";
  const p = torontoParts(d);
  return `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** The `HH:MM` Toronto wall-clock time an instant falls on. */
export function toTimeInputValue(
  value: Date | string | null | undefined
): string {
  const d = toDate(value);
  if (!d) return "";
  const p = torontoParts(d);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/**
 * Turn a Toronto wall-clock date + time into a UTC instant (ISO string).
 *
 * Inverse of `toDateInputValue` / `toTimeInputValue`. The typed time is always
 * read as Toronto time, never as the browser's timezone — an admin editing
 * from anywhere sets the same moment.
 */
export function fromDateTimeInputs(
  dateValue: string,
  timeValue = "12:00"
): string {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue?.trim() ?? "");
  if (!dateMatch) return "";
  const timeMatch = /^(\d{1,2}):(\d{2})/.exec(timeValue?.trim() || "12:00");
  if (!timeMatch) return "";

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]) - 1;
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  // Treat the wall time as UTC, then subtract Toronto's offset. The offset
  // depends on the instant we are solving for, so iterate: the first pass
  // lands within an hour, the second settles DST boundaries.
  const wallAsUtc = Date.UTC(year, month, day, hour, minute, 0);
  let instant = wallAsUtc;
  for (let i = 0; i < 2; i++) {
    instant = wallAsUtc - torontoOffsetMs(new Date(instant));
  }
  return new Date(instant).toISOString();
}
