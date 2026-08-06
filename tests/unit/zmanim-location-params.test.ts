import { describe, it, expect } from "vitest";
import { parseLocationParams, parseLocationParamsOrToronto } from "@/lib/zmanim-location-params";
import { TORONTO_LOCATION } from "@/lib/zmanim-location";

const p = (s: string) => new URLSearchParams(s);

describe("parseLocationParams (strict — the API contract)", () => {
  it("defaults to Toronto when no location params are present", () => {
    const r = parseLocationParams(p(""));
    expect("location" in r && r.location).toEqual(TORONTO_LOCATION);
  });

  it("accepts a complete valid set", () => {
    const r = parseLocationParams(p("lat=31.77&lon=35.21&tzid=Asia/Jerusalem&label=Jerusalem&il=1"));
    expect("location" in r).toBe(true);
    if ("location" in r) {
      expect(r.location.lat).toBeCloseTo(31.77);
      expect(r.location.isIsrael).toBe(true);
    }
  });

  it.each(["lat=999&lon=0&tzid=UTC", "lat=&lon=0&tzid=UTC", "lat=43&lon=500&tzid=UTC"])(
    "rejects out-of-range coordinates (%s)",
    (qs) => expect("error" in parseLocationParams(p(qs))).toBe(true)
  );

  // The 500-on-a-page bug: non-empty was the only check, so this reached
  // toLocaleTimeString and threw a RangeError.
  it("rejects a tzid that is not a real IANA zone", () => {
    expect("error" in parseLocationParams(p("lat=43&lon=-79&tzid=Nowhere/Fake"))).toBe(true);
  });
});

describe("parseLocationParamsOrToronto (lenient — the page contract)", () => {
  it.each([
    "lat=999&lon=0&tzid=UTC",
    "lat=43&lon=-79&tzid=Nowhere/Fake",
    "lat=&lon=&tzid=",
  ])("falls back to Toronto rather than erroring (%s)", (qs) => {
    expect(parseLocationParamsOrToronto(p(qs))).toEqual(TORONTO_LOCATION);
  });

  it("still returns a valid location when the params are good", () => {
    expect(parseLocationParamsOrToronto(p("lat=31.77&lon=35.21&tzid=Asia/Jerusalem&label=Jerusalem")).tzid)
      .toBe("Asia/Jerusalem");
  });
});
