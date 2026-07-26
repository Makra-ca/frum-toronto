import { describe, it, expect } from "vitest";
import { resolvePrimaryZman } from "@/lib/hero/primaryZman";

const CANDLES = new Date("2026-07-25T00:31:00Z"); // Fri 8:31 PM Toronto
const HAVDALAH = new Date("2026-07-26T01:38:00Z"); // Sat 9:38 PM Toronto
const UPCOMING = new Date("2026-08-01T00:23:00Z"); // next Fri 8:23 PM Toronto

describe("resolvePrimaryZman", () => {
  it("prefers tonight's candle lighting on erev Shabbos", () => {
    const r = resolvePrimaryZman({
      candleLighting: CANDLES,
      havdalah: null,
      upcomingCandleLighting: UPCOMING,
    });
    expect(r).toEqual({ time: CANDLES, label: "Candle lighting" });
  });

  it("uses havdalah on Shabbos, when there is no candle lighting", () => {
    const r = resolvePrimaryZman({
      candleLighting: null,
      havdalah: HAVDALAH,
      upcomingCandleLighting: UPCOMING,
    });
    expect(r).toEqual({ time: HAVDALAH, label: "Havdalah" });
  });

  it("falls back to the upcoming Shabbos on an ordinary weekday", () => {
    const r = resolvePrimaryZman({
      candleLighting: null,
      havdalah: null,
      upcomingCandleLighting: UPCOMING,
    });
    expect(r).toEqual({ time: UPCOMING, label: "Candle lighting Fri" });
  });

  it("returns null when nothing is available, so the caller can show the wordmark", () => {
    expect(
      resolvePrimaryZman({
        candleLighting: null,
        havdalah: null,
        upcomingCandleLighting: null,
      })
    ).toBeNull();
  });

  it("prefers candle lighting over havdalah when a day somehow has both", () => {
    const r = resolvePrimaryZman({
      candleLighting: CANDLES,
      havdalah: HAVDALAH,
      upcomingCandleLighting: UPCOMING,
    });
    expect(r?.label).toBe("Candle lighting");
  });

  it("never returns an invalid Date", () => {
    const inputs = [
      { candleLighting: CANDLES, havdalah: null, upcomingCandleLighting: null },
      { candleLighting: null, havdalah: HAVDALAH, upcomingCandleLighting: null },
      { candleLighting: null, havdalah: null, upcomingCandleLighting: UPCOMING },
    ];
    for (const input of inputs) {
      const r = resolvePrimaryZman(input);
      expect(r).not.toBeNull();
      expect(r!.time).toBeInstanceOf(Date);
      expect(Number.isNaN(r!.time.getTime())).toBe(false);
      expect(r!.label.length).toBeGreaterThan(0);
    }
  });

  it("treats an Invalid Date as absent rather than rendering it", () => {
    // Guards the parse path: new Date("nonsense") is a Date object, not null, and
    // would otherwise be formatted as "Invalid Date" in the hub.
    const r = resolvePrimaryZman({
      candleLighting: new Date("nonsense"),
      havdalah: null,
      upcomingCandleLighting: UPCOMING,
    });
    expect(r).toEqual({ time: UPCOMING, label: "Candle lighting Fri" });
  });
});
