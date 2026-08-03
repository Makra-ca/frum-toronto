import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestUser, cleanupTestUsers, testDb } from "./utils/test-db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { canManageAtr } from "@/lib/auth/atr-permissions";

/**
 * The Ask the Rabbi capability check.
 *
 * The five rabbi-submissions handlers required `role === "admin"`, so the one
 * person holding canManageAskTheRabbi — a `member` — could not use the
 * submissions inbox at all, while every other Ask the Rabbi route already
 * accepted the capability.
 */

// canManageAtr takes a Session, matching the isAuthorized() it replaces. A
// signature taking a user-shaped object would still typecheck when handed a
// whole Session (every property optional) and return false for everyone.
const asSession = (id: number, role: string) =>
  ({ user: { id: String(id), role } }) as never;

describe("Ask the Rabbi permission check", () => {
  let adminId: number;
  let managerId: number;
  let plainId: number;

  beforeAll(async () => {
    adminId = (
      await createTestUser({
        email: "test-atr-admin@frumtoronto.test",
        role: "admin",
      })
    ).id;
    managerId = (
      await createTestUser({
        email: "test-atr-manager@frumtoronto.test",
        role: "member",
        canManageAskTheRabbi: true,
      })
    ).id;
    plainId = (
      await createTestUser({
        email: "test-atr-plain@frumtoronto.test",
        role: "member",
      })
    ).id;
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  it("allows an admin", async () => {
    expect(await canManageAtr(asSession(adminId, "admin"))).toBe(true);
  });

  it("allows a member holding canManageAskTheRabbi", async () => {
    // Guards against createTestUser silently dropping the field, which would
    // make this pass for the wrong reason.
    const [row] = await testDb
      .select({ f: users.canManageAskTheRabbi })
      .from(users)
      .where(eq(users.id, managerId));
    expect(row.f).toBe(true);

    // The whole point: the real holder is role 'member'.
    expect(await canManageAtr(asSession(managerId, "member"))).toBe(true);
  });

  it("refuses an ordinary member", async () => {
    expect(await canManageAtr(asSession(plainId, "member"))).toBe(false);
  });

  it("refuses a missing session", async () => {
    expect(await canManageAtr(null)).toBe(false);
    expect(await canManageAtr(undefined)).toBe(false);
    expect(await canManageAtr({ user: {} } as never)).toBe(false);
  });

  it("reads the database, not a stale token flag", async () => {
    // The session really does carry canManageAskTheRabbi (auth.ts:81), so a
    // future "optimisation" could read it instead of querying. This pins the
    // behaviour in both directions.

    // Token says false, database says true — the token may predate the grant.
    const stale = {
      user: { id: String(managerId), role: "member", canManageAskTheRabbi: false },
    } as never;
    expect(await canManageAtr(stale)).toBe(true);

    // Token says true, database says false — never trust the claim.
    const forged = {
      user: { id: String(plainId), role: "member", canManageAskTheRabbi: true },
    } as never;
    expect(await canManageAtr(forged)).toBe(false);
  });
});
