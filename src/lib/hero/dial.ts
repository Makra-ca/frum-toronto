// src/lib/hero/dial.ts
//
// Pure geometry and clock maths for the homepage dial. No React, no DOM, no
// hebcal — everything here is a function of its arguments, so the whole thing is
// unit-testable and the component holds no maths of its own.
//
// The ring carries one tick per 20 minutes of the day (72 in total), with every
// sixth tick — each two hours — drawn longer. Ticks for time already elapsed
// today are dimmed by the component; this module only reports which ones they
// are.

export interface TickMark {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** True when this 20-minute slot has already passed today. */
  elapsed: boolean;
}

export interface NodePosition {
  /** Percentage across the container, 0-100. */
  x: number;
  /** Percentage down the container, 0-100. */
  y: number;
}

export const TICKS_PER_DAY = 72;
export const MINUTES_PER_TICK = 24 * 60 / TICKS_PER_DAY; // 20

const MINOR_TICK_LENGTH = 7;
const MAJOR_TICK_LENGTH = 14;

/**
 * Tick marks for a `size` x `size` SVG viewBox, drawn inward from `radius`.
 *
 * The first tick sits at the top of the ring and represents local midnight;
 * they run clockwise from there, like a clock face.
 *
 * `minutesElapsed` is clamped, so callers may pass an unvalidated clock reading.
 */
export function getTickMarks(
  size: number,
  radius: number,
  minutesElapsed: number,
): TickMark[] {
  const centre = size / 2;
  const elapsedTicks = Math.floor(
    Math.min(Math.max(minutesElapsed, 0), 24 * 60) / MINUTES_PER_TICK,
  );

  return Array.from({ length: TICKS_PER_DAY }, (_, i) => {
    // -90 degrees puts tick 0 at the top rather than at 3 o'clock.
    const angle = ((i / TICKS_PER_DAY) * 360 - 90) * (Math.PI / 180);
    const length = i % 6 === 0 ? MAJOR_TICK_LENGTH : MINOR_TICK_LENGTH;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return {
      x1: centre + cos * radius,
      y1: centre + sin * radius,
      x2: centre + cos * (radius - length),
      y2: centre + sin * (radius - length),
      elapsed: i < elapsedTicks,
    };
  });
}

/**
 * Evenly-spaced position for node `index` of `count`, rotated by `angleDeg`.
 *
 * Returned as percentages of the container so the caller can place nodes without
 * knowing the pixel size. Node 0 at `angleDeg = 0` sits at the top.
 */
export function getNodePosition(
  index: number,
  count: number,
  angleDeg: number,
  radiusPct: number,
): NodePosition {
  const base = (index / count) * 360;
  const rad = ((base + angleDeg) * Math.PI) / 180;

  return {
    x: 50 + Math.sin(rad) * radiusPct,
    y: 50 - Math.cos(rad) * radiusPct,
  };
}

/**
 * Minutes since local midnight in `tzid`, clamped to 0-1440.
 *
 * Read via Intl rather than Date's local getters: the dial must reflect the
 * displayed location's clock, not the server's or the viewer's.
 */
export function minutesElapsedInDay(now: Date, tzid: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tzid,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const value = (type: "hour" | "minute"): number => {
    const found = parts.find((p) => p.type === type);
    if (!found) throw new Error(`[HERO-DIAL] missing ${type} for tzid ${tzid}`);
    return Number(found.value);
  };

  const minutes = value("hour") * 60 + value("minute");
  return Math.min(Math.max(minutes, 0), 24 * 60);
}
