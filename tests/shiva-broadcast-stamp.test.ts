import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createTestUser, cleanupTestUsers } from "./utils/test-db";

/**
 * A shiva notice must be announced at most ONCE, ever.
 *
 * `setApprovalStatus` guards the approval path with `broadcast_at`, and
 * `community/shiva` create stamps it. `admin/shiva` create sent the email and
 * did NOT stamp — so the row was announced while still carrying
 * `broadcast_at = NULL`.
 *
 * That is the exact hole `broadcast_at` exists to close. A transition rule alone
 * is defeated by a trip through `rejected`, which erases publication history:
 *
 *   admin creates (emailed, unstamped) → rejected by mistake → approved again
 *   → previous="rejected", broadcast_at=NULL → every guard passes → RE-EMAILED
 *
 * For a bereavement notice, to the whole subscriber list, because an admin
 * corrected a mistake.
 *
 * Found by chasing a review claim that turned out to be wrong about the
 * mechanism but right about the smell.
 */

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: String(adminId), role: "admin", email: "test-shivastamp@frumtoronto.test" },
  })),
}));
vi.mock("@/lib/email/send", () => ({
  sendShivaNoticeEmail: vi.fn(async () => true),
}));
vi.mock("@/lib/notifications", () => ({
  notifyAdminOfSubmission: vi.fn(async () => undefined),
  notifySubmitter: vi.fn(async () => undefined),
}));

const { POST } = await import("@/app/api/admin/shiva/route");
const { db } = await import("@/lib/db");
const { shivaNotifications } = await import("@/lib/db/schema");

const stamp = Date.now();
let adminId = 0;
const createdIds: number[] = [];

beforeAll(async () => {
  adminId = (
    await createTestUser({
      email: `test-shivastamp@frumtoronto.test`,
      role: "admin",
      emailVerified: new Date(),
    })
  ).id;
});

afterAll(async () => {
  if (createdIds.length) {
    await db.delete(shivaNotifications).where(inArray(shivaNotifications.id, createdIds));
  }
  await cleanupTestUsers();
});

describe("an admin-created shiva notice", () => {
  it("stamps broadcast_at when it sends the as-posted email", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/shiva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niftarName: `[TEST] Niftar ${stamp}`,
          mournerNames: ["[TEST] Mourner"],
          shivaStart: "2026-08-10",
          shivaEnd: "2026-08-16",
        }),
      }) as never
    );

    expect(res.status).toBe(201);
    const created = await res.json();
    createdIds.push(created.id);

    const [row] = await db
      .select({
        approvalStatus: shivaNotifications.approvalStatus,
        broadcastAt: shivaNotifications.broadcastAt,
      })
      .from(shivaNotifications)
      .where(eq(shivaNotifications.id, created.id));

    expect(row.approvalStatus).toBe("approved");
    // The load-bearing assertion. Announced, so the row must say so — otherwise
    // a later approve can announce it a second time.
    expect(row.broadcastAt).not.toBeNull();
  });
});
