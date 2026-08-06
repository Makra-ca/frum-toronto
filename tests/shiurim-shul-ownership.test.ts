import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestUser, cleanupTestUsers } from "./utils/test-db";

/**
 * POST /api/shiurim wrote `shulId` raw.
 *
 * A shiur carrying a shulId appears on that shul's public page. The equivalent
 * route for events (`community/events/route.ts`) checks `canUserManageShul`
 * before writing it; this one did not, so anyone holding the shiurim posting
 * permission could attach a shiur to any shul in the directory — putting a
 * class they control on a shul's page, under that shul's name.
 *
 * Narrow in practice (two accounts hold the permission today) but the control
 * is the same one events already enforce.
 */

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: String(currentUserId), role: currentRole } })),
}));
vi.mock("@/lib/notifications", () => ({
  notifyAdminOfSubmission: vi.fn(async () => undefined),
}));

const { POST } = await import("@/app/api/shiurim/route");
const { db } = await import("@/lib/db");
const { shuls, shiurim, userShuls } = await import("@/lib/db/schema");

const stamp = Date.now();
let currentUserId = 0;
let currentRole = "member";
let posterId = 0;
let managerId = 0;
let ownShulId = 0;
let otherShulId = 0;

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/shiurim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never
  );

beforeAll(async () => {
  posterId = (
    await createTestUser({
      email: `test-shiur-poster-${stamp}@frumtoronto.test`,
      emailVerified: new Date(),
      canAutoApproveShiurim: true,
    })
  ).id;
  managerId = (
    await createTestUser({
      email: `test-shiur-manager-${stamp}@frumtoronto.test`,
      role: "shul",
      emailVerified: new Date(),
      canAutoApproveShiurim: true,
    })
  ).id;

  const [a] = await db
    .insert(shuls)
    .values({ name: `[TEST] Managed Shul ${stamp}`, slug: `test-shiur-own-${stamp}` })
    .returning({ id: shuls.id });
  ownShulId = a.id;

  const [b] = await db
    .insert(shuls)
    .values({ name: `[TEST] Other Shul ${stamp}`, slug: `test-shiur-other-${stamp}` })
    .returning({ id: shuls.id });
  otherShulId = b.id;

  await db.insert(userShuls).values({ userId: managerId, shulId: ownShulId });

  currentUserId = posterId;
});

afterAll(async () => {
  await db.delete(shiurim).where(eq(shiurim.shulId, ownShulId));
  await db.delete(shiurim).where(eq(shiurim.shulId, otherShulId));
  await db.delete(userShuls).where(eq(userShuls.shulId, ownShulId));
  await db.delete(shuls).where(eq(shuls.id, ownShulId));
  await db.delete(shuls).where(eq(shuls.id, otherShulId));
  await cleanupTestUsers();
});

describe("attaching a shiur to a shul", () => {
  it("is refused for a shul the poster does not manage", async () => {
    currentUserId = posterId;
    currentRole = "member";

    const res = await post({
      title: `[TEST] Hijacked Shiur ${stamp}`,
      shulId: String(otherShulId),
    });

    expect(res.status).toBe(403);

    const rows = await db.select().from(shiurim).where(eq(shiurim.shulId, otherShulId));
    expect(rows).toHaveLength(0);
  });

  it("is allowed for a shul the poster manages", async () => {
    currentUserId = managerId;
    currentRole = "shul";

    const res = await post({
      title: `[TEST] Legitimate Shiur ${stamp}`,
      shulId: String(ownShulId),
    });

    expect(res.status).toBe(201);

    const rows = await db.select().from(shiurim).where(eq(shiurim.shulId, ownShulId));
    expect(rows).toHaveLength(1);
  });

  it("is allowed for an admin, matching the events route", async () => {
    // Note the route resolves the role from the DATABASE row, not from the
    // session token — so this needs a real admin account, and a session
    // claiming role "admin" over a member row does not pass. That is the
    // stricter behaviour and the right one: a token claiming admin is exactly
    // what the escalation fixed in ad81bdb was.
    const adminId = (
      await createTestUser({
        email: `test-shiur-admin-${stamp}@frumtoronto.test`,
        role: "admin",
        emailVerified: new Date(),
      })
    ).id;

    currentUserId = adminId;
    currentRole = "admin";

    const res = await post({
      title: `[TEST] Admin Shiur ${stamp}`,
      shulId: String(otherShulId),
    });

    expect(res.status).toBe(201);
  });

  it("does NOT accept a session token claiming admin over a member row", async () => {
    currentUserId = posterId;
    currentRole = "admin";

    const res = await post({
      title: `[TEST] Forged Admin Shiur ${stamp}`,
      shulId: String(otherShulId),
    });

    expect(res.status).toBe(403);
  });

  it("still accepts a shiur with no shul at all", async () => {
    currentUserId = posterId;
    currentRole = "member";

    const res = await post({ title: `[TEST] Standalone Shiur ${stamp}` });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.shulId).toBeNull();
    await db.delete(shiurim).where(eq(shiurim.id, body.id));
  });
});
