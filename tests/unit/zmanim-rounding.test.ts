import { describe, it, expect } from "vitest";
import { roundZman, formatZman, ZMAN_DIRECTION } from "@/lib/zmanim-format";
import { getZmanimForDate } from "@/lib/zmanim";
import { TORONTO_LOCATION } from "@/lib/zmanim-location";

const TZ = TORONTO_LOCATION.tzid;

describe("roundZman", () => {
  it('rounds UP to the next whole minute for an "earliest" time', () => {
    // Tzeis 9:36:17 PM -> 9:37 PM. Shabbos ends a moment later, never earlier.
    const t = new Date("2026-07-28T01:36:17Z");
    expect(roundZman(t, "up").toISOString()).toBe("2026-07-28T01:37:00.000Z");
  });

  it("rounds DOWN to the whole minute for a deadline", () => {
    // Sof zman shma 9:42:45 AM -> 9:42 AM. Never says you have until 9:43.
    const t = new Date("2026-07-27T13:42:45Z");
    expect(roundZman(t, "down").toISOString()).toBe("2026-07-27T13:42:00.000Z");
  });

  it("leaves an exact minute untouched in both directions", () => {
    const t = new Date("2026-07-27T13:42:00.000Z");
    expect(roundZman(t, "up").toISOString()).toBe("2026-07-27T13:42:00.000Z");
    expect(roundZman(t, "down").toISOString()).toBe("2026-07-27T13:42:00.000Z");
  });

  it("discards milliseconds rather than letting them force a round up", () => {
    const t = new Date("2026-07-27T13:42:00.400Z");
    expect(roundZman(t, "up").toISOString()).toBe("2026-07-27T13:42:00.000Z");
  });

  it("carries into the next hour", () => {
    const t = new Date("2026-07-27T13:59:30Z");
    expect(roundZman(t, "up").toISOString()).toBe("2026-07-27T14:00:00.000Z");
  });
});

describe("the safety rule: never show more room than there really is", () => {
  const day = new Date(Date.UTC(2026, 6, 27, 12));
  const r = getZmanimForDate(day, TORONTO_LOCATION);

  it("never displays a deadline later than its true moment", () => {
    const deadlines = [
      r.zmanim.sofZmanShma,
      r.zmanim.sofZmanShmaMGA,
      r.zmanim.sofZmanTfilla,
      r.zmanim.sofZmanTfillaMGA,
      r.zmanim.chatzot,
      r.zmanim.sunset,
    ];
    for (const d of deadlines) {
      expect(roundZman(d, "down").getTime()).toBeLessThanOrEqual(d.getTime());
    }
  });

  it("never displays a permitted-from time earlier than its true moment", () => {
    const earliest = [
      r.zmanim.alotHaShachar,
      r.zmanim.misheyakir,
      r.zmanim.sunrise,
      r.zmanim.minchaGedola,
      r.zmanim.minchaKetana,
      r.zmanim.plagHaMincha,
      r.zmanim.tzait,
      r.zmanim.tzait72,
    ];
    for (const d of earliest) {
      expect(roundZman(d, "up").getTime()).toBeGreaterThanOrEqual(d.getTime());
    }
  });

  it("never shifts any zman by a whole minute or more", () => {
    for (const [key, dir] of Object.entries(ZMAN_DIRECTION)) {
      const value = (r.zmanim as unknown as Record<string, Date | undefined>)[key];
      if (!value) continue;
      const shift = Math.abs(roundZman(value, dir).getTime() - value.getTime());
      expect(shift, key).toBeLessThan(60_000);
    }
  });
});

describe("every zman is classified", () => {
  it("assigns a direction to each key in ZmanimTimes", () => {
    const r = getZmanimForDate(new Date(Date.UTC(2026, 6, 27, 12)), TORONTO_LOCATION);
    for (const key of Object.keys(r.zmanim)) {
      expect(ZMAN_DIRECTION[key as keyof typeof ZMAN_DIRECTION], `${key} has no rounding direction`).toBeDefined();
    }
  });

  it("classifies candle lighting as a deadline and havdalah as earliest", () => {
    expect(ZMAN_DIRECTION.candleLighting).toBe("down");
    expect(ZMAN_DIRECTION.havdalah).toBe("up");
  });
});

describe("formatZman", () => {
  it("formats a deadline downward and an earliest time upward", () => {
    const shma = new Date("2026-07-27T13:42:45Z"); // 9:42:45 AM Toronto
    const tzeis = new Date("2026-07-28T01:36:17Z"); // 9:36:17 PM Toronto
    expect(formatZman(shma, TZ, "down")).toBe("9:42 AM");
    expect(formatZman(tzeis, TZ, "up")).toBe("9:37 PM");
  });

  it("returns null for a missing time rather than a placeholder", () => {
    expect(formatZman(null, TZ, "up")).toBeNull();
  });
});
