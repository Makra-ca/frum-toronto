import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import { users } from "@/lib/db/schema";
import { testDb, createTestUser } from "./utils/test-db";
import { resolveApprovalStatus } from "@/lib/submissions/auto-approve";

/**
 * The status an edit (or a create) lands on.
 *
 * Four of these exist because the first draft of the rule got them wrong:
 *
 *   - a second edit before review must STAY `pending_edit`. Decaying to
 *     `pending` makes the next approval look like a first approval, which is
 *     exactly what fires the broadcast — so pressing Save twice would re-email
 *     the whole community.
 *
 *   - an auto-approver editing REJECTED content must not republish it. A
 *     rejection is an admin decision; the edit path must not overturn it.
 *
 *   - an auto-approver and an admin editing a LIVE item must stay `approved`.
 *     Anything else means the permission ("your posts go live without review")
 *     is silently revoked the moment its holder fixes a typo.
 */

const stamp = Date.now();
const createdUserIds: number[] = [];

let memberId: number;
let trustedId: number;
let adminId: number;

beforeAll(async () => {
  const member = await createTestUser({
    email: `test-aa-member-${stamp}@frumtoronto.test`,
    role: "member",
  });
  const trusted = await createTestUser({
    email: `test-aa-trusted-${stamp}@frumtoronto.test`,
    role: "member",
    canAutoApproveEvents: true,
  });
  const admin = await createTestUser({
    email: `test-aa-admin-${stamp}@frumtoronto.test`,
    role: "admin",
  });

  // The flag must actually be on the row. createTestUser whitelists its fields,
  // so a field it forgets is silently dropped and every auto-approve assertion
  // below would pass for the wrong reason.
  expect(trusted.canAutoApproveEvents).toBe(true);
  expect(member.canAutoApproveEvents).toBe(false);

  memberId = member.id;
  trustedId = trusted.id;
  adminId = admin.id;
  createdUserIds.push(member.id, trusted.id, admin.id);
});

afterAll(async () => {
  if (createdUserIds.length) {
    await testDb.delete(users).where(inArray(users.id, createdUserIds));
  }
});

describe("resolveApprovalStatus", () => {
  it("keeps an ordinary member's new submission pending", async () => {
    expect(await resolveApprovalStatus("event", memberId, "member", null)).toBe(
      "pending"
    );
  });

  it("publishes an auto-approver's new submission straight away", async () => {
    expect(await resolveApprovalStatus("event", trustedId, "member", null)).toBe(
      "approved"
    );
  });

  it("sends a member's edit of a LIVE item to pending_edit", async () => {
    expect(
      await resolveApprovalStatus("event", memberId, "member", "approved")
    ).toBe("pending_edit");
  });

  it("KEEPS pending_edit on a second edit before review", async () => {
    expect(
      await resolveApprovalStatus("event", memberId, "member", "pending_edit")
    ).toBe("pending_edit");
  });

  it("leaves a member's edit of a still-pending item pending", async () => {
    expect(
      await resolveApprovalStatus("event", memberId, "member", "pending")
    ).toBe("pending");
  });

  it("does NOT let an auto-approver silently republish rejected content", async () => {
    expect(
      await resolveApprovalStatus("event", trustedId, "member", "rejected")
    ).toBe("pending");
  });

  it("does NOT let an admin silently republish rejected content either", async () => {
    expect(
      await resolveApprovalStatus("event", adminId, "admin", "rejected")
    ).toBe("pending");
  });

  it("leaves an auto-approver's edit of a live item approved", async () => {
    expect(
      await resolveApprovalStatus("event", trustedId, "member", "approved")
    ).toBe("approved");
  });

  it("leaves an admin's edit of a live item approved", async () => {
    expect(
      await resolveApprovalStatus("event", adminId, "admin", "approved")
    ).toBe("approved");
  });

  it("reads the flag belonging to the type, not any auto-approve flag", async () => {
    // trustedId holds canAutoApproveEvents only. Asking about a simcha must not
    // inherit it — one flag granting every type is a privilege escalation.
    expect(await resolveApprovalStatus("simcha", trustedId, "member", null)).toBe(
      "pending"
    );
  });

  it("treats a missing user as untrusted rather than throwing", async () => {
    expect(await resolveApprovalStatus("event", 999999999, "member", null)).toBe(
      "pending"
    );
  });

  it("does not treat a shul or business role as an admin", async () => {
    expect(await resolveApprovalStatus("event", memberId, "shul", "approved")).toBe(
      "pending_edit"
    );
  });
});
