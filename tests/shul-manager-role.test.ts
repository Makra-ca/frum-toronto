import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createTestUser, cleanupTestUsers } from "./utils/test-db";

/**
 * Assigning a shul manager overwrote the user's role unconditionally:
 *
 *   // Update user role to "shul" if not already
 *   await db.update(users).set({ role: "shul" }).where(eq(users.id, userId));
 *
 * The comment describes a guard the code does not have. UserPicker lists every
 * user with no role filter, so picking the admin from that dropdown demoted the
 * site's only admin out of /admin — with a success toast and no way back.
 *
 * The un-assign path in user-shuls/[id] already guards correctly
 * (`if (user.role === "shul")`); the two promotion paths did not.
 */

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "1", role: "admin" } })),
}));

const { POST } = await import("@/app/api/admin/user-shuls/route");
const { db } = await import("@/lib/db");
const { users, shuls, userShuls } = await import("@/lib/db/schema");
const { canUserManageShul } = await import("@/lib/auth/permissions");

const stamp = Date.now();
let shulId: number;
const userIds: number[] = [];

beforeAll(async () => {
  const [shul] = await db
    .insert(shuls)
    .values({ name: `[TEST] shul ${stamp}`, slug: `test-shul-role-${stamp}` })
    .returning({ id: shuls.id });
  shulId = shul.id;
});

afterAll(async () => {
  if (userIds.length) {
    await db.delete(userShuls).where(inArray(userShuls.userId, userIds));
  }
  await db.delete(shuls).where(eq(shuls.id, shulId));
  await cleanupTestUsers();
});

async function assign(userId: number) {
  return POST(
    new Request("http://localhost/api/admin/user-shuls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, shulId }),
    }) as never
  );
}

async function roleOf(id: number) {
  const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, id));
  return u.role;
}

describe("assigning a shul manager", () => {
  it("never demotes an admin", async () => {
    const admin = await createTestUser({
      email: `test-shulrole-admin-${stamp}@frumtoronto.test`,
      role: "admin",
    });
    userIds.push(admin.id);

    const res = await assign(admin.id);
    expect(res.status).toBe(200);

    // Fails today: the unconditional update writes "shul" over "admin",
    // locking the account out of /admin entirely.
    expect(await roleOf(admin.id)).toBe("admin");
  });

  it("promotes an ordinary member so the dashboard link appears", async () => {
    const member = await createTestUser({
      email: `test-shulrole-member-${stamp}@frumtoronto.test`,
      role: "member",
    });
    userIds.push(member.id);

    await assign(member.id);
    expect(await roleOf(member.id)).toBe("shul");
  });

  it("leaves any other role alone", async () => {
    const biz = await createTestUser({
      email: `test-shulrole-biz-${stamp}@frumtoronto.test`,
      role: "business",
    });
    userIds.push(biz.id);

    await assign(biz.id);
    expect(await roleOf(biz.id)).toBe("business");
  });
});

describe("canUserManageShul", () => {
  it("honours the assignment regardless of role", async () => {
    // The userShuls row is the source of truth — it can only be created by an
    // admin. Requiring role === "shul" on top of it meant that leaving a role
    // untouched (above) would silently break the assignment.
    const biz = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, `test-shulrole-biz-${stamp}@frumtoronto.test`));

    expect(await canUserManageShul(biz[0].id, shulId, "business")).toBe(true);
  });

  it("refuses a user with no assignment", async () => {
    const stranger = await createTestUser({
      email: `test-shulrole-none-${stamp}@frumtoronto.test`,
      role: "member",
    });
    userIds.push(stranger.id);

    expect(await canUserManageShul(stranger.id, shulId, "member")).toBe(false);
  });

  it("still allows any admin", async () => {
    expect(await canUserManageShul(999999, shulId, "admin")).toBe(true);
  });
});
