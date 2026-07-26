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

  it("draws every tick inward from the ring radius", () => {
    const centre = SIZE / 2;
    for (const t of getTickMarks(SIZE, RADIUS, 0)) {
      const outer = Math.hypot(t.x1 - centre, t.y1 - centre);
      const inner = Math.hypot(t.x2 - centre, t.y2 - centre);
      expect(outer).toBeCloseTo(RADIUS, 6);
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
      expect(len(i), `tick ${i}`).toBeCloseTo(i % 6 === 0 ? major : minor, 6);
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
    expect(gap(0)).toBeCloseTo(gap(137), 6);
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
