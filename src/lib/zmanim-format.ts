// src/lib/zmanim-format.ts
//
// How a zman is rounded for display.
//
// The underlying Date stays exact; this is presentation only. The rule is one
// sentence:
//
//     never show a time that gives someone more room than they actually have.
//
// So a DEADLINE rounds DOWN and a PERMITTED-FROM time rounds UP. Truncating
// everything (the old behaviour, inherited from toLocaleTimeString) breaks the
// rule in one direction; rounding everything to the nearest minute breaks it in
// both. Concretely: sof zman shma at 9:42:45 must never display as 9:43, because
// someone glancing at 9:42:50 would believe they still had time.
//
// We deliberately do NOT display seconds. Our values sit 2-9 seconds from
// MyZmanim's purely because their coordinates for "Toronto" differ from ours by
// about 0.023 degrees; printing seconds would imply a precision the inputs do not
// support. MyZmanim prints "do not rely on zmanim times to the last moment" above
// its own seconds for the same reason.

export type RoundDirection = "up" | "down";

/**
 * Rounding direction per zman. Every key of ZmanimTimes must appear here — a
 * unit test enforces that, so a newly added zman cannot silently default.
 */
export const ZMAN_DIRECTION = {
  // Permitted-from times: round UP, so nothing is done a moment too early.
  alotHaShachar: "up",
  misheyakir: "up",
  sunrise: "up",
  minchaGedola: "up",
  minchaKetana: "up",
  plagHaMincha: "up",
  tzait: "up",
  tzait72: "up",
  havdalah: "up",

  // Deadlines: round DOWN, so nobody is told they have longer than they do.
  sofZmanShma: "down",
  sofZmanShmaMGA: "down",
  sofZmanTfilla: "down",
  sofZmanTfillaMGA: "down",
  chatzot: "down",
  sunset: "down",
  candleLighting: "down",
} as const satisfies Record<string, RoundDirection>;

export type ZmanKey = keyof typeof ZMAN_DIRECTION;

/**
 * Round to a whole minute in the given direction.
 *
 * Sub-second precision is discarded first: a time at 13:42:00.400 is 13:42 for
 * every practical purpose, and must not be pushed to 13:43 by 400ms.
 */
export function roundZman(date: Date, direction: RoundDirection): Date {
  const wholeSeconds = Math.floor(date.getTime() / 1000) * 1000;
  const remainder = wholeSeconds % 60_000;

  if (remainder === 0) return new Date(wholeSeconds);
  return new Date(
    direction === "up" ? wholeSeconds - remainder + 60_000 : wholeSeconds - remainder,
  );
}

/**
 * Round and format for display. Returns null when there is no such time, so the
 * caller omits the row rather than rendering a placeholder.
 */
export function formatZman(
  date: Date | null | undefined,
  tzid: string,
  direction: RoundDirection,
): string | null {
  if (!date) return null;

  return roundZman(date, direction).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tzid,
  });
}

/** Convenience for the common case: look the direction up by key. */
export function formatZmanByKey(
  key: ZmanKey,
  date: Date | null | undefined,
  tzid: string,
): string | null {
  return formatZman(date, tzid, ZMAN_DIRECTION[key]);
}
