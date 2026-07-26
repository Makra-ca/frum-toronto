// src/lib/hero/primaryZman.ts
//
// Decides which single zman the hero strip and the dial hub display.
//
// `getZmanimForDate()` returns candleLighting only on erev Shabbos and Yom Tov,
// and havdalah only when the day ends one of them. On a Tuesday both are null —
// so a hub wired straight to `candleLighting` would be empty five days a week.
// This is the one place that decision is made; the strip and the hub both consume
// the result, so they cannot disagree.
//
// Deliberately pure, with three Date inputs and no location or clock parameter:
// that keeps @hebcal/core out of the client bundle, since the client receives
// already-computed times from /api/zmanim. Any import from lib/zmanim here must
// be `import type`.

export interface PrimaryZman {
  time: Date;
  label: string;
}

export interface PrimaryZmanInput {
  /** Tonight's candle lighting, if today is erev Shabbos or Yom Tov. */
  candleLighting: Date | null;
  /** Tonight's havdalah, if today ends Shabbos or Yom Tov. */
  havdalah: Date | null;
  /** The coming Friday's candle lighting, for every other day. */
  upcomingCandleLighting: Date | null;
}

/**
 * An Invalid Date is an object, not null, so a bad parse would otherwise reach
 * the hub and render as "Invalid Date". Treat it as absent.
 */
function usable(d: Date | null): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

/**
 * Applies the fallback chain. Returns null when no zman is available at all,
 * which is the caller's signal to show the wordmark instead and to omit the
 * strip's zman segment entirely — never a placeholder like "--:--".
 */
export function resolvePrimaryZman(input: PrimaryZmanInput): PrimaryZman | null {
  if (usable(input.candleLighting)) {
    return { time: input.candleLighting, label: "Candle lighting" };
  }
  if (usable(input.havdalah)) {
    return { time: input.havdalah, label: "Havdalah" };
  }
  if (usable(input.upcomingCandleLighting)) {
    return { time: input.upcomingCandleLighting, label: "Candle lighting Fri" };
  }
  return null;
}
