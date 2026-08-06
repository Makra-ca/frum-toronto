import { describe, it, expect } from "vitest";
import { getZmanimForDate } from "@/lib/zmanim";
import { formatZmanByKey, ZMAN_DIRECTION } from "@/lib/zmanim-format";
import { TORONTO_LOCATION } from "@/lib/zmanim-location";

const TZ = TORONTO_LOCATION.tzid;
const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

describe("alos 72 minutes", () => {
  it("is exactly 72 clock minutes before sunrise, in both solstices", () => {
    for (const d of [day(2026, 6, 21), day(2026, 12, 21)]) {
      const { zmanim } = getZmanimForDate(d, TORONTO_LOCATION);
      const delta = zmanim.sunrise.getTime() - zmanim.alotHaShachar72.getTime();
      expect(delta).toBe(72 * 60_000);
    }
  });
});

describe("misheyakir 45 minutes", () => {
  it("is exactly 45 clock minutes before sunrise", () => {
    const { zmanim } = getZmanimForDate(day(2026, 8, 1), TORONTO_LOCATION);
    expect(zmanim.sunrise.getTime() - zmanim.misheyakir45.getTime()).toBe(45 * 60_000);
  });

  // The regression. sunriseOffset(-45, true) TRUNCATES seconds, so the value
  // reaches roundZman already at :00, roundZman returns early, and the "up"
  // direction never applies — printing a minute EARLY for an earliest-permitted
  // time. Reintroducing `true` turns these back to 5:21/5:24.
  // Measured at TORONTO_LOCATION's real coordinates (43.6629, -79.3957).
  // With `true` these read 5:21 and 5:25 — a minute early.
  it.each([
    [day(2026, 8, 1), "5:22 AM"],
    [day(2026, 8, 4), "5:26 AM"],
  ])("rounds up rather than truncating (%s)", (d, expected) => {
    const { zmanim } = getZmanimForDate(d, TORONTO_LOCATION);
    expect(formatZmanByKey("misheyakir45", zmanim.misheyakir45, TZ)).toBe(expected);
  });
});

// The INVARIANT, not two hand-picked dates (spec section 6.1). A zman that
// reaches roundZman already at :00 seconds silently loses its rounding policy —
// its ZMAN_DIRECTION entry stays present and the coverage test keeps passing,
// which is how this shipped to production twice.
//
// havdalah is excluded: it is now the same Date object as tzait by construction
// (commit e78c6dc), so it is covered by tzait's own row here.
describe("no zman reaches roundZman pre-rounded", () => {
  it("every zman carries real seconds on at least most days of a month", () => {
    const preRounded: Record<string, number> = {};
    for (let d = 1; d <= 31; d++) {
      const { zmanim } = getZmanimForDate(day(2026, 8, d), TORONTO_LOCATION);
      for (const [k, v] of Object.entries(zmanim)) {
        if ((v as Date).getSeconds() === 0) preRounded[k] = (preRounded[k] ?? 0) + 1;
      }
    }
    // A genuine :00 lands about 1 day in 60 by chance. A zman that is
    // systematically pre-rounded shows up at or near 31.
    const systematic = Object.entries(preRounded).filter(([, n]) => n > 3);
    expect(systematic).toEqual([]);
  });
});

describe("rounding registration", () => {
  it("registers both as permitted-from times", () => {
    expect(ZMAN_DIRECTION.alotHaShachar72).toBe("up");
    expect(ZMAN_DIRECTION.misheyakir45).toBe("up");
  });
});
