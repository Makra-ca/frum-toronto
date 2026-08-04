import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestUser, cleanupTestUsers } from "./utils/test-db";
import { loadUserClaims, DEFAULT_CLAIMS } from "@/lib/auth/user-claims";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * Privilege escalation, verified by exploit on 2026-08-04 and fixed the same
 * day.
 *
 * The jwt callback's `update` branch did:
 *
 *   if (trigger === "update" && session) {
 *     token.role = session.role;          // straight from the client
 *     token.isTrusted = session.isTrusted;
 *   }
 *
 * `session` is whatever the caller POSTed to /api/auth/session. A plain member
 * sending {"data":{"role":"admin"}} became an admin: /admin went 307 -> 200 and
 * /api/admin/users returned 200. Middleware, auth.config and ~101 admin API
 * routes all trust that one token field.
 *
 * The fix ignores the payload and re-reads from the database. These tests pin
 * the helper that does the reading — if someone reintroduces a client-trusting
 * path, the claims here are the contract it would have to violate.
 */

let memberId: number;
let adminId: number;

beforeAll(async () => {
  memberId = (
    await createTestUser({
      email: "test-claims-member@frumtoronto.test",
      role: "member",
    })
  ).id;
  adminId = (
    await createTestUser({
      email: "test-claims-admin@frumtoronto.test",
      role: "admin",
      isTrusted: true,
      canManageAskTheRabbi: true,
    })
  ).id;
});

afterAll(async () => {
  await cleanupTestUsers();
});

describe("loadUserClaims", () => {
  it("returns what the database says, by id", async () => {
    expect(await loadUserClaims({ id: memberId })).toEqual({
      role: "member",
      isTrusted: false,
      canManageAskTheRabbi: false,
    });
  });

  it("accepts a string id, as the JWT carries it", async () => {
    // token.id is a string; a parseInt bug here would silently return null and
    // leave whatever claims the token already had.
    expect(await loadUserClaims({ id: String(adminId) })).toEqual({
      role: "admin",
      isTrusted: true,
      canManageAskTheRabbi: true,
    });
  });

  it("looks up by email case-insensitively", async () => {
    const claims = await loadUserClaims({
      email: "TEST-CLAIMS-ADMIN@FRUMTORONTO.TEST",
    });
    expect(claims?.role).toBe("admin");
  });

  it("returns null for an unknown user rather than defaulting", async () => {
    // null lets the caller decide between keeping existing claims and falling
    // back — it must never silently grant anything.
    expect(await loadUserClaims({ id: 99999999 })).toBeNull();
    expect(await loadUserClaims({ email: "nobody@frumtoronto.test" })).toBeNull();
  });

  it("reflects a role change made after the session was issued", async () => {
    // This is the legitimate use of update(): a role granted while someone is
    // logged in should be picked up without re-authenticating.
    await db.update(users).set({ role: "admin" }).where(eq(users.id, memberId));
    expect((await loadUserClaims({ id: memberId }))?.role).toBe("admin");

    await db.update(users).set({ role: "member" }).where(eq(users.id, memberId));
    expect((await loadUserClaims({ id: memberId }))?.role).toBe("member");
  });

  it("defaults grant nothing", () => {
    expect(DEFAULT_CLAIMS).toEqual({
      role: "member",
      isTrusted: false,
      canManageAskTheRabbi: false,
    });
  });
});
