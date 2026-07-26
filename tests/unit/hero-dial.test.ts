import { describe, it, expect } from "vitest";
import {
  TICKS_PER_DAY,
  MINUTES_PER_TICK,
  getTickMarks,
  getNodePosition,
  minutesElapsedInDay,
} from "@/lib/hero/dial";

describe("tick geometry", () => {
  const SIZE = 400;
  const RADIUS = 150;

  it("produces one tick per 20 minutes of the day", () => {
    expect(TICKS_PER_DAY).toBe(72);
    expect(MINUTES_PER_TICK).toBe(20);
    expect(TICKS_PER_DAY * MINUTES_PER_TICK).toBe(1440);
    expect(getTickMarks(SIZE, RADIUS, 0)).toHaveLength(72);
  });

  // Distances derived from coordinates that are rounded to 4 decimals carry up to
  // ~1e-4 of error, so these tolerances are precision 3 rather than 6. See the
  // rounding rationale in src/lib/hero/dial.ts.
  it("draws every tick inward from the ring radius", () => {
    const centre = SIZE / 2;
    for (const t of getTickMarks(SIZE, RADIUS, 0)) {
      const outer = Math.hypot(t.x1 - centre, t.y1 - centre);
      const inner = Math.hypot(t.x2 - centre, t.y2 - centre);
      expect(outer).toBeCloseTo(RADIUS, 3);
      expect(inner).toBeLessThan(outer);
    }
  });

  it("makes every sixth tick — each two hours — longer than its neighbours", () => {
    const marks = getTickMarks(SIZE, RADIUS, 0);
    const len = (i: number) =>
      Math.hypot(marks[i].x1 - marks[i].x2, marks[i].y1 - marks[i].y2);

    const major = len(0);
    const minor = len(1);
    expect(major).toBeGreaterThan(minor);

    for (let i = 0; i < 72; i++) {
      expect(len(i), `tick ${i}`).toBeCloseTo(i % 6 === 0 ? major : minor, 3);
    }
    // 72 / 6 = 12 major marks, one every two hours.
    expect(marks.filter((_, i) => i % 6 === 0)).toHaveLength(12);
  });

  it("starts the first tick at the top of the ring (midnight)", () => {
    const [first] = getTickMarks(SIZE, RADIUS, 0);
    expect(first.x1).toBeCloseTo(SIZE / 2, 6);
    expect(first.y1).toBeCloseTo(SIZE / 2 - RADIUS, 6);
  });
});

describe("elapsed-tick boundaries", () => {
  const count = (minutesElapsed: number) =>
    getTickMarks(400, 150, minutesElapsed).filter((t) => t.elapsed).length;

  it.each([
    [0, 0],
    [19, 0],
    [20, 1],
    [21, 1],
    [720, 36],
    [1439, 71],
    [1440, 72],
  ])("marks %i minutes elapsed as %i elapsed ticks", (minutes, expected) => {
    expect(count(minutes)).toBe(expected);
  });

  it("never reports more elapsed ticks than exist, even for absurd input", () => {
    expect(count(99_999)).toBe(72);
    expect(count(-50)).toBe(0);
  });
});

describe("node placement", () => {
  it("spaces eight nodes at 45-degree intervals", () => {
    const positions = Array.from({ length: 8 }, (_, i) => getNodePosition(i, 8, 0, 40));

    // First node sits at the top: centre x, minimum y.
    expect(positions[0].x).toBeCloseTo(50, 6);
    expect(positions[0].y).toBeCloseTo(10, 6);
    // Fourth node is diametrically opposite.
    expect(positions[4].x).toBeCloseTo(50, 6);
    expect(positions[4].y).toBeCloseTo(90, 6);
    // All eight are distinct.
    expect(new Set(positions.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`)).size).toBe(8);
  });

  it("treats a full rotation as no rotation", () => {
    const a = getNodePosition(3, 8, 0, 40);
    const b = getNodePosition(3, 8, 360, 40);
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(b.y).toBeCloseTo(a.y, 6);
  });

  it("keeps every position within the 0-100 percentage box", () => {
    for (let angle = 0; angle < 360; angle += 7) {
      for (let i = 0; i < 8; i++) {
        const p = getNodePosition(i, 8, angle, 40);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(100);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(100);
      }
    }
  });

  it("rotates all nodes together, preserving their spacing", () => {
    const gap = (angle: number) => {
      const a = getNodePosition(0, 8, angle, 40);
      const b = getNodePosition(1, 8, angle, 40);
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    expect(gap(0)).toBeCloseTo(gap(137), 3);
  });
});

describe("minutesElapsedInDay", () => {
  // 2026-07-26T04:30:00Z is 00:30 in Toronto (UTC-4) and 07:30 in Jerusalem.
  const instant = new Date("2026-07-26T04:30:00Z");

  it("reads the clock in the supplied timezone, not the runner's", () => {
    expect(minutesElapsedInDay(instant, "America/Toronto")).toBe(30);
    expect(minutesElapsedInDay(instant, "Asia/Jerusalem")).toBe(7 * 60 + 30);
    expect(minutesElapsedInDay(instant, "UTC")).toBe(4 * 60 + 30);
  });

  it("returns 0 at local midnight", () => {
    // 04:00Z is exactly midnight in Toronto during EDT.
    expect(minutesElapsedInDay(new Date("2026-07-26T04:00:00Z"), "America/Toronto")).toBe(0);
  });

  it("stays within 0-1440 for every hour of a day", () => {
    for (let h = 0; h < 24; h++) {
      const d = new Date(Date.UTC(2026, 6, 26, h, 0, 0));
      const m = minutesElapsedInDay(d, "America/Toronto");
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThanOrEqual(1440);
    }
  });
});

describe("coordinates are rounded so SSR and the client agree", () => {
  // Math.cos/Math.sin are not bit-identical across V8 builds, so the server and
  // the browser serialise these numbers differently in the 14th decimal place —
  // enough for React to report a hydration mismatch on every tick. Rounding in
  // the pure module removes the class of problem entirely.
  const isRounded = (n: number) => Math.abs(n - Math.round(n * 1e4) / 1e4) < 1e-12;

  it("rounds every tick coordinate to 4 decimal places", () => {
    for (const t of getTickMarks(400, 158, 500)) {
      for (const v of [t.x1, t.y1, t.x2, t.y2]) {
        expect(isRounded(v), `${v} is not rounded`).toBe(true);
      }
    }
  });

  it("rounds every node percentage to 4 decimal places", () => {
    for (let angle = 0; angle < 360; angle += 11) {
      for (let i = 0; i < 8; i++) {
        const p = getNodePosition(i, 8, angle, 38);
        expect(isRounded(p.x), `${p.x} is not rounded`).toBe(true);
        expect(isRounded(p.y), `${p.y} is not rounded`).toBe(true);
      }
    }
  });
});
