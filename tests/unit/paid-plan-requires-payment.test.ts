import { describe, it, expect } from "vitest";
import { resolveBusinessApprovalStatus } from "@/lib/permissions/auto-approve-targets";

/**
 * Any member could self-assign the $120/mo Elite plan.
 *
 * `subscriptionPlanId` and `pendingPayment` are both client-supplied on
 * business creation. The plan row was loaded only to check `maxCategories` —
 * nothing compared its price against `pendingPayment`, and no subscription was
 * required. POSTing `{ subscriptionPlanId: 5 }` with `pendingPayment` omitted
 * put an Elite listing in the ordinary review queue, where the approving admin
 * saw no sign the tier had never been paid for.
 *
 * Elite grants shoutouts, homepage banner AND sidebar, 999 photos and 100
 * categories. Live prices: Free 0.00, Standard 27.00, Premium 65.00,
 * Elite 120.00.
 */

describe("a paid plan can never reach the review queue unpaid", () => {
  it("forces pending_payment for a paid plan, whatever the client says", () => {
    // The exploit: ask for Elite, omit pendingPayment.
    expect(
      resolveBusinessApprovalStatus({
        pendingPayment: false,
        isTrusted: false,
        canAutoApproveBusinesses: false,
        planPriceMonthly: "120.00",
      })
    ).toBe("pending_payment");
  });

  it("is not bypassable by a trusted user or the auto-approve flag", () => {
    // Permission to skip REVIEW is not permission to skip PAYING.
    expect(
      resolveBusinessApprovalStatus({
        pendingPayment: false,
        isTrusted: true,
        canAutoApproveBusinesses: true,
        planPriceMonthly: "120.00",
      })
    ).toBe("pending_payment");
  });

  it("treats every paid tier the same", () => {
    for (const price of ["27.00", "65.00", "120.00", "0.01"]) {
      expect(
        resolveBusinessApprovalStatus({
          pendingPayment: false,
          isTrusted: false,
          canAutoApproveBusinesses: false,
          planPriceMonthly: price,
        })
      ).toBe("pending_payment");
    }
  });

  it("leaves the free tier alone", () => {
    expect(
      resolveBusinessApprovalStatus({
        pendingPayment: false,
        isTrusted: false,
        canAutoApproveBusinesses: false,
        planPriceMonthly: "0.00",
      })
    ).toBe("pending");

    expect(
      resolveBusinessApprovalStatus({
        pendingPayment: false,
        isTrusted: true,
        canAutoApproveBusinesses: false,
        planPriceMonthly: "0.00",
      })
    ).toBe("approved");
  });

  it("treats a missing or unparseable price as paid", () => {
    // Fail closed: an unknown price must not grant a free pass.
    for (const price of [null, undefined, "", "abc"] as const) {
      expect(
        resolveBusinessApprovalStatus({
          pendingPayment: false,
          isTrusted: true,
          canAutoApproveBusinesses: true,
          planPriceMonthly: price,
        })
      ).toBe("pending_payment");
    }
  });

  it("still honours an explicit pendingPayment on a free plan", () => {
    expect(
      resolveBusinessApprovalStatus({
        pendingPayment: true,
        isTrusted: true,
        canAutoApproveBusinesses: true,
        planPriceMonthly: "0.00",
      })
    ).toBe("pending_payment");
  });
});
