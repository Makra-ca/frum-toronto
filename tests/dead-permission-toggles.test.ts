import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { inArray } from "drizzle-orm";
import { createTestUser, cleanupTestUsers } from "./utils/test-db";

/**
 * Three permission toggles were saved by the admin dialog and read by no code
 * anywhere: canAutoApproveBusinesses, canAutoApproveAskTheRabbi,
 * canAutoApproveShuls. Ticking one produced a success toast and no behaviour
 * change.
 *
 * Each now attaches to the one real approval step in its area:
 *   businesses    -> businesses/create, alongside the existing isTrusted check
 *   ask the rabbi -> comment moderation (questions are answered, not approved)
 *   shuls         -> a request to manage a shul is granted without review
 */

vi.mock("@/lib/notifications", () => ({
  notifyAdminOfSubmission: vi.fn(async () => undefined),
  createAdminNotification: vi.fn(async () => undefined),
}));

const { db } = await import("@/lib/db");
const s = await import("@/lib/db/schema");
const { resolveBusinessApprovalStatus } = await import(
  "@/lib/permissions/auto-approve-targets"
);
const { resolveCommentApprovalStatus } = await import(
  "@/lib/permissions/auto-approve-targets"
);
const { shouldAutoGrantShulRequest } = await import(
  "@/lib/permissions/auto-approve-targets"
);

const userIds: number[] = [];

afterAll(async () => {
  await cleanupTestUsers();
});

describe("canAutoApproveBusinesses", () => {
  it("sends an ordinary member's listing to the queue", () => {
    expect(
      resolveBusinessApprovalStatus({
        pendingPayment: false,
        isTrusted: false,
        canAutoApproveBusinesses: false,
      })
    ).toBe("pending");
  });

  it("publishes a holder's listing immediately", () => {
    // Fails before the fix: the flag was read by nothing.
    expect(
      resolveBusinessApprovalStatus({
        pendingPayment: false,
        isTrusted: false,
        canAutoApproveBusinesses: true,
      })
    ).toBe("approved");
  });

  it("keeps the existing isTrusted path working", () => {
    expect(
      resolveBusinessApprovalStatus({
        pendingPayment: false,
        isTrusted: true,
        canAutoApproveBusinesses: false,
      })
    ).toBe("approved");
  });

  it("never publishes something still awaiting payment", () => {
    // pending_payment must win over both flags: nothing is paid for yet.
    expect(
      resolveBusinessApprovalStatus({
        pendingPayment: true,
        isTrusted: true,
        canAutoApproveBusinesses: true,
      })
    ).toBe("pending_payment");
  });
});

describe("canAutoApproveAskTheRabbi", () => {
  it("moderates a restricted account's comment", () => {
    expect(
      resolveCommentApprovalStatus({
        isManager: false,
        commentPermission: "moderated",
        canAutoApproveAskTheRabbi: false,
      })
    ).toBe("pending");
  });

  it("lets a holder's comment through despite moderation", () => {
    // Fails before the fix.
    expect(
      resolveCommentApprovalStatus({
        isManager: false,
        commentPermission: "moderated",
        canAutoApproveAskTheRabbi: true,
      })
    ).toBe("approved");
  });

  it("leaves an unrestricted account alone", () => {
    expect(
      resolveCommentApprovalStatus({
        isManager: false,
        commentPermission: "allowed",
        canAutoApproveAskTheRabbi: false,
      })
    ).toBe("approved");
  });

  it("still lets a manager through", () => {
    expect(
      resolveCommentApprovalStatus({
        isManager: true,
        commentPermission: "requires_approval",
        canAutoApproveAskTheRabbi: false,
      })
    ).toBe("approved");
  });
});

describe("canAutoApproveShuls", () => {
  it("queues an ordinary member's request", () => {
    expect(shouldAutoGrantShulRequest({ canAutoApproveShuls: false })).toBe(false);
  });

  it("grants a holder's request without review", () => {
    // Fails before the fix. This one hands over control of a shul listing —
    // deliberate, and the reason it is a permission rather than a default.
    expect(shouldAutoGrantShulRequest({ canAutoApproveShuls: true })).toBe(true);
  });
});

describe("the flags are readable from the database", () => {
  beforeAll(async () => {
    const u = await createTestUser({
      email: "test-toggles@frumtoronto.test",
      role: "member",
      canAutoApproveBusinesses: true,
      canAutoApproveAskTheRabbi: true,
      canAutoApproveShuls: true,
    });
    userIds.push(u.id);
  });

  it("round-trips all three", async () => {
    const [row] = await db
      .select({
        b: s.users.canAutoApproveBusinesses,
        a: s.users.canAutoApproveAskTheRabbi,
        sh: s.users.canAutoApproveShuls,
      })
      .from(s.users)
      .where(inArray(s.users.id, userIds));
    expect(row).toEqual({ b: true, a: true, sh: true });
  });
});
