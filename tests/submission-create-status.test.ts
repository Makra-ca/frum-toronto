import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createTestUser } from "./utils/test-db";
import { resolveApprovalStatus } from "@/lib/submissions/auto-approve";
import { SUBMISSION_TYPES, type SubmissionType } from "@/lib/submissions/types";

/**
 * Every create path resolves its status through the same helper as every edit
 * path. Driven from SUBMISSION_TYPES so adding a type cannot quietly skip it.
 *
 * This pins a behaviour CHANGE: community/shiva and community/tehillim did not
 * check `role === "admin"` while the other five did, so an admin posting a
 * shiva notice through the public form landed in the approval queue behind
 * their own approval. Seven routes, two different rules — exactly the drift a
 * shared helper exists to prevent.
 */

const stamp = Date.now();
const createdUserIds: number[] = [];
const TYPES = Object.keys(SUBMISSION_TYPES) as SubmissionType[];

let memberId: number;
let adminId: number;

beforeAll(async () => {
  const member = await createTestUser({
    email: `test-create-member-${stamp}@frumtoronto.test`,
    role: "member",
  });
  const admin = await createTestUser({
    email: `test-create-admin-${stamp}@frumtoronto.test`,
    role: "admin",
  });
  memberId = member.id;
  adminId = admin.id;
  createdUserIds.push(member.id, admin.id);
});

afterAll(async () => {
  if (createdUserIds.length) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

describe("the status a new submission lands on", () => {
  it.each(TYPES)("%s: an ordinary member's submission waits for review", async (type) => {
    expect(await resolveApprovalStatus(type, memberId, "member", null)).toBe(
      "pending"
    );
  });

  it.each(TYPES)("%s: an admin's submission is published", async (type) => {
    expect(await resolveApprovalStatus(type, adminId, "admin", null)).toBe(
      "approved"
    );
  });

  it.each(TYPES)("%s: the type's own flag publishes it", async (type) => {
    const field = SUBMISSION_TYPES[type].autoApproveField;
    const user = await createTestUser({
      email: `test-create-${type}-${stamp}@frumtoronto.test`,
      role: "member",
      [field]: true,
    });
    createdUserIds.push(user.id);

    // The flag must be ON the row. createTestUser whitelists its fields, and a
    // field it forgets is dropped silently — the assertion below would then
    // pass for the wrong reason.
    expect(user[field]).toBe(true);

    expect(await resolveApprovalStatus(type, user.id, "member", null)).toBe(
      "approved"
    );
  });
});
