import { describe, it, expect } from "vitest";
import { aspectWarning, slotFill, SLOT_RATIOS } from "@/lib/ads/aspect";

/**
 * The slot ratios were measured in a browser against the rendered components,
 * so these tests double as the record of what was measured.
 */
describe("SLOT_RATIOS", () => {
  it("has a very wide banner and slightly portrait sidebars", () => {
    expect(SLOT_RATIOS.banner).toBeGreaterThan(5);
    // Easy to get backwards: the sidebars are TALLER than they are wide, so a
    // wide banner-style image wastes most of one.
    expect(SLOT_RATIOS["sidebar-left"]).toBeLessThan(1);
    expect(SLOT_RATIOS["sidebar-right"]).toBe(SLOT_RATIOS["sidebar-left"]);
  });
});

describe("slotFill", () => {
  it("is 1 when the image matches the slot exactly", () => {
    expect(slotFill(2, 2)).toBe(1);
  });

  it("is symmetric — being twice too wide wastes as much as twice too tall", () => {
    expect(slotFill(4, 2)).toBeCloseTo(0.5, 5);
    expect(slotFill(1, 2)).toBeCloseTo(0.5, 5);
  });

  it("returns 0 for degenerate input rather than NaN or Infinity", () => {
    for (const [a, b] of [
      [0, 2],
      [2, 0],
      [-1, 2],
      [NaN, 2],
      [2, NaN],
      [Infinity, 2],
    ]) {
      expect(slotFill(a, b)).toBe(0);
    }
  });
});

describe("aspectWarning", () => {
  it("warns severely about a portrait flyer in the banner", () => {
    // The real case: the TorahMasters semicha poster, measured at 0.73 natural
    // ratio in a 7.8 slot — it covered about 9% of the banner.
    const warning = aspectWarning("banner", 800, 1100);
    expect(warning?.severity).toBe("severe");
    expect(warning!.fill).toBeLessThan(0.15);
    expect(warning!.message).toContain("sidebar");
  });

  it("warns about a wide banner-style image dropped in a sidebar", () => {
    const warning = aspectWarning("sidebar-left", 1200, 300);
    expect(warning?.severity).toBe("severe");
    // The suggestion must name the fix, not just the problem.
    expect(warning!.message).toContain("banner");
  });

  it("accepts a square image in a sidebar", () => {
    // Ratio 1.0 against a 0.78 slot fills 78% — fine, even though the numbers
    // do not match. A naive "ratios must be close" rule would wrongly warn.
    expect(aspectWarning("sidebar-left", 600, 600)).toBeNull();
  });

  it("accepts a wide strip in the banner", () => {
    expect(aspectWarning("banner", 1560, 200)).toBeNull();
  });

  it("still warns about a landscape image that is not portrait at all", () => {
    // 4:3 is landscape, so a "warn only if portrait" rule would miss it — yet it
    // covers barely half the banner.
    const warning = aspectWarning("banner", 1200, 900);
    expect(warning).not.toBeNull();
    expect(warning!.fill).toBeLessThan(0.25);
  });

  it("reports a percentage that matches the computed fill", () => {
    const warning = aspectWarning("banner", 800, 1100);
    const percent = Math.round(warning!.fill * 100);
    expect(warning!.message).toContain(`${percent}%`);
  });

  it("returns null rather than dividing by zero before an image has loaded", () => {
    expect(aspectWarning("banner", 0, 0)).toBeNull();
    expect(aspectWarning("banner", 800, 0)).toBeNull();
  });
});
