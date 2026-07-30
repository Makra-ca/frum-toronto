import { describe, it, expect } from "vitest";
import { createAdSchema, updateAdSchema, moderateAdSchema, adRulesSchema } from "@/lib/validations/ads";

const VALID = {
  title: "TorahMasters Semicha",
  imageUrl: "https://abc123.public.blob.vercel-storage.com/homepage-ads/flyer.jpg",
  placement: "banner",
  linkType: "none",
};

function firstError(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? null : result.error!.issues[0].message;
}

describe("createAdSchema", () => {
  it("accepts a link-free flyer", () => {
    expect(createAdSchema.safeParse(VALID).success).toBe(true);
  });

  it("rejects an unknown placement", () => {
    const result = createAdSchema.safeParse({ ...VALID, placement: "popup" });
    expect(result.success).toBe(false);
  });

  it("rejects the retired two-value placement", () => {
    // 'sidebar' was split into sidebar-left / sidebar-right.
    expect(createAdSchema.safeParse({ ...VALID, placement: "sidebar" }).success).toBe(false);
  });

  it("accepts each of the three positions", () => {
    for (const placement of ["banner", "sidebar-left", "sidebar-right"]) {
      expect(createAdSchema.safeParse({ ...VALID, placement }).success).toBe(true);
    }
  });

  describe("external links", () => {
    it("accepts a scheme-less address, which is what people type", () => {
      // The whole reason this does not use z.string().url(): that would REJECT
      // this and ACCEPT javascript:alert(1).
      const result = createAdSchema.safeParse({
        ...VALID,
        linkType: "external",
        linkUrl: "torahmasters.org",
      });
      expect(result.success).toBe(true);
    });

    it.each([
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "httpevil:payload",
      "file:///etc/passwd",
    ])("rejects the unsafe scheme %s", (linkUrl) => {
      const result = createAdSchema.safeParse({ ...VALID, linkType: "external", linkUrl });
      expect(result.success).toBe(false);
      expect(firstError(result)).toMatch(/valid web address/i);
    });

    it("requires a URL when the link type says external", () => {
      const result = createAdSchema.safeParse({ ...VALID, linkType: "external" });
      expect(result.success).toBe(false);
      expect(firstError(result)).toMatch(/web address/i);
    });
  });

  it("requires a business when the link type says business", () => {
    const result = createAdSchema.safeParse({ ...VALID, linkType: "business" });
    expect(result.success).toBe(false);
    expect(firstError(result)).toMatch(/choose the business/i);
  });

  it("accepts a business link with a business", () => {
    const result = createAdSchema.safeParse({ ...VALID, linkType: "business", businessId: 7 });
    expect(result.success).toBe(true);
  });

  it("requires a title and an image", () => {
    expect(createAdSchema.safeParse({ ...VALID, title: "   " }).success).toBe(false);
    expect(createAdSchema.safeParse({ ...VALID, imageUrl: "" }).success).toBe(false);
  });

  describe("scheduling", () => {
    const start = "2026-08-01T00:00:00.000Z";
    const end = "2026-09-01T00:00:00.000Z";

    it("accepts a forward window", () => {
      expect(
        createAdSchema.safeParse({ ...VALID, startsAt: start, endsAt: end }).success
      ).toBe(true);
    });

    it("rejects a backwards window, which would silently never show", () => {
      const result = createAdSchema.safeParse({ ...VALID, startsAt: end, endsAt: start });
      expect(result.success).toBe(false);
      expect(firstError(result)).toMatch(/after the start date/i);
    });

    it("rejects equal dates", () => {
      expect(
        createAdSchema.safeParse({ ...VALID, startsAt: start, endsAt: start }).success
      ).toBe(false);
    });

    it("accepts one bound without the other", () => {
      expect(createAdSchema.safeParse({ ...VALID, startsAt: start }).success).toBe(true);
      expect(createAdSchema.safeParse({ ...VALID, endsAt: end }).success).toBe(true);
    });
  });
});

describe("updateAdSchema", () => {
  it("accepts a single-field edit", () => {
    expect(updateAdSchema.safeParse({ title: "New title" }).success).toBe(true);
    expect(updateAdSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it("accepts an empty body", () => {
    expect(updateAdSchema.safeParse({}).success).toBe(true);
  });

  it("still refuses an unsafe URL on an edit", () => {
    // Safety is judgeable on a fragment, so it stays on this schema.
    expect(
      updateAdSchema.safeParse({ linkType: "external", linkUrl: "javascript:alert(1)" }).success
    ).toBe(false);
    expect(updateAdSchema.safeParse({ linkUrl: "data:text/html,x" }).success).toBe(false);
  });

  it("does NOT judge completeness on a fragment", () => {
    // `{linkType:'business'}` alone is unjudgeable: the businessId may already be
    // on the stored row. Completeness moved to adRulesSchema, which the PATCH
    // route applies to the merged result. Asserting `false` here would force the
    // route to reject a legitimate "just change the link type" edit.
    expect(updateAdSchema.safeParse({ linkType: "business" }).success).toBe(true);
    expect(adRulesSchema.safeParse({ linkType: "business", businessId: null }).success).toBe(false);
  });
});

describe("moderateAdSchema", () => {
  it("accepts approve and reject", () => {
    expect(moderateAdSchema.safeParse({ approvalStatus: "approved" }).success).toBe(true);
    expect(
      moderateAdSchema.safeParse({ approvalStatus: "rejected", rejectionReason: "Blurry" }).success
    ).toBe(true);
  });

  it("refuses to set pending back through moderation", () => {
    // Moderation is a decision; un-deciding is not one of the actions offered.
    expect(moderateAdSchema.safeParse({ approvalStatus: "pending" }).success).toBe(false);
  });
});
