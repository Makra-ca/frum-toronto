import { describe, it, expect } from "vitest";
import { updateAdSchema, createAdSchema, adRulesSchema } from "@/lib/validations/ads";

/**
 * Regression tests for the PATCH data-loss bug.
 *
 * `linkType` carried a Zod `.default("none")`. `.partial()` does NOT strip a
 * default — it wraps the defaulted schema, so the default still fired on an
 * absent key. `updateAdSchema.safeParse({ isActive: false })` therefore returned
 * `{ linkType: "none", isActive: false }`, the route's
 * `if (data.linkType !== undefined)` was always true, and EVERY edit — including
 * the one-click on/off toggle in the admin list — silently reset the ad's link
 * type to none and nulled its URL. A paying advertiser's click-through vanished
 * with no error shown anywhere.
 *
 * Every assertion below fails against the previous schema.
 */
describe("updateAdSchema — absent keys must stay absent", () => {
  it.each([
    ["a title-only edit", { title: "New" }],
    ["the on/off toggle", { isActive: false }],
    ["an empty body", {}],
    ["a placement move", { placement: "sidebar-left" }],
  ])("does not invent a linkType for %s", (_label, body) => {
    const result = updateAdSchema.safeParse(body);
    expect(result.success).toBe(true);
    // The whole bug in one assertion.
    expect(result.data).not.toHaveProperty("linkType");
    expect(result.data).not.toHaveProperty("linkUrl");
  });

  it("keeps a linkType that WAS sent", () => {
    const result = updateAdSchema.safeParse({ linkType: "none" });
    expect(result.success).toBe(true);
    expect(result.data!.linkType).toBe("none");
  });

  it("still rejects an unknown linkType", () => {
    expect(updateAdSchema.safeParse({ linkType: "carrier-pigeon" }).success).toBe(false);
  });
});

describe("createAdSchema — absent means none, but only on create", () => {
  const VALID = {
    title: "Flyer",
    imageUrl: "https://blob.example/a.jpg",
    placement: "banner",
  };

  it("defaults linkType to none", () => {
    const result = createAdSchema.safeParse(VALID);
    expect(result.success).toBe(true);
    expect(result.data!.linkType).toBe("none");
  });

  it("still enforces the link rules", () => {
    expect(
      createAdSchema.safeParse({ ...VALID, linkType: "external", linkUrl: "javascript:alert(1)" })
        .success
    ).toBe(false);
    expect(createAdSchema.safeParse({ ...VALID, linkType: "business" }).success).toBe(false);
  });
});

/**
 * The cross-field rules could not be checked on a partial body, because the
 * missing half lives in the stored row. Changing only `startsAt` on an ad whose
 * `endsAt` was already earlier passed Zod and died on the database CHECK as a
 * 500. The route now merges onto the stored row and validates the result.
 */
describe("adRulesSchema — validates a resolved ad, not a fragment", () => {
  it("rejects a window that is backwards once merged", () => {
    const result = adRulesSchema.safeParse({
      linkType: "none",
      startsAt: "2026-09-01T00:00:00.000Z",
      endsAt: "2026-02-01T00:00:00.000Z", // came from the stored row
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toMatch(/after the start date/i);
  });

  it("accepts a forward window", () => {
    expect(
      adRulesSchema.safeParse({
        linkType: "none",
        startsAt: "2026-02-01T00:00:00.000Z",
        endsAt: "2026-09-01T00:00:00.000Z",
      }).success
    ).toBe(true);
  });

  it("accepts Date objects, which is what the stored row yields", () => {
    expect(
      adRulesSchema.safeParse({
        linkType: "none",
        startsAt: new Date("2026-02-01"),
        endsAt: new Date("2026-09-01"),
      }).success
    ).toBe(true);
  });

  it("rejects an external ad left with no URL after the merge", () => {
    expect(adRulesSchema.safeParse({ linkType: "external", linkUrl: null }).success).toBe(false);
  });

  it("rejects a business ad left with no business after the merge", () => {
    expect(adRulesSchema.safeParse({ linkType: "business", businessId: null }).success).toBe(false);
  });

  it("accepts an unscheduled link-free ad", () => {
    expect(adRulesSchema.safeParse({ linkType: "none" }).success).toBe(true);
  });
});
