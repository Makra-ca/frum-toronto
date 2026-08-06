import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestUser, cleanupTestUsers } from "./utils/test-db";

/**
 * PATCH /api/admin/users/[id] had no schema and no guards.
 *
 * Two separate problems:
 *
 * 1. `role` was an unvalidated string written straight to the column. Every
 *    check in the codebase compares `role === "admin"` exactly, so a bad value
 *    ("Admin", "administrtor") fails closed — it does not escalate, it locks
 *    the account out of everything, silently, with a success toast.
 *
 * 2. Nothing stopped the LAST active admin being demoted or disabled.
 *    Production has exactly one. There is no in-app recovery: /admin,
 *    middleware and ~101 admin API routes all gate on the role, so the only way
 *    back is direct SQL against production.
 */

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => ({
    user: {
      id: String(actingAdminId),
      role: "admin",
      email: "test-guard-admin@frumtoronto.test",
    },
  })),
}));

const { PATCH } = await import("@/app/api/admin/users/[id]/route");
const { db } = await import("@/lib/db");
const { users, auditLog } = await import("@/lib/db/schema");

const stamp = Date.now();
let actingAdminId = 0;
let secondAdminId = 0;
let memberId = 0;

const patch = (id: number, body: unknown) =>
  PATCH(
    new Request(`http://localhost/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ id: String(id) }) } as never
  );

beforeAll(async () => {
  actingAdminId = (
    await createTestUser({
      email: `test-guard-admin@frumtoronto.test`,
      role: "admin",
    })
  ).id;
  memberId = (
    await createTestUser({ email: `test-guard-member-${stamp}@frumtoronto.test` })
  ).id;
});

afterAll(async () => {
  await db.delete(auditLog).where(eq(auditLog.actorId, actingAdminId));
  await cleanupTestUsers();
});

describe("role validation", () => {
  it("rejects a role that is not one of the five the UI offers", async () => {
    for (const role of ["Admin", "administrator", "superuser", ""]) {
      const res = await patch(memberId, { role });
      expect(res.status, `role=${JSON.stringify(role)}`).toBe(400);
    }

    const [after] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, memberId));
    expect(after.role).toBe("member");
  });

  it("accepts a real role", async () => {
    const res = await patch(memberId, { role: "content_contributor" });
    expect(res.status).toBe(200);

    const [after] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, memberId));
    expect(after.role).toBe("content_contributor");

    await patch(memberId, { role: "member" });
  });

  it("rejects a commentPermission outside the known set", async () => {
    const res = await patch(memberId, { commentPermission: "silenced" });
    expect(res.status).toBe(400);
  });
});

describe("the last-admin guard, through the route", () => {
  /*
    The decision itself is pinned in tests/unit/last-admin.test.ts. It cannot be
    driven to the blocking state here: the integration database is a copy of
    production, which always contains a real active admin, so the count of
    "other active admins" is never zero. What IS worth proving through the route
    is the other direction — that a guard which sits in front of every user edit
    does not start refusing ordinary ones.
  */
  it("does not block demoting an admin while another admin exists", async () => {
    secondAdminId = (
      await createTestUser({
        email: `test-guard-admin2-${stamp}@frumtoronto.test`,
        role: "admin",
      })
    ).id;

    const res = await patch(secondAdminId, { role: "member" });
    expect(res.status).toBe(200);

    const [after] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, secondAdminId));
    expect(after.role).toBe("member");
  });

  it("does not block changes to a non-admin", async () => {
    const res = await patch(memberId, { isActive: false });
    expect(res.status).toBe(200);
    await patch(memberId, { isActive: true });
  });
});

describe("audit trail", () => {
  it("records what changed, before and after", async () => {
    // logAudit() had zero callers, so audit_log recorded nothing at all —
    // which is why the privilege escalation fixed in ad81bdb left no
    // reconstructible trail. Privilege changes are the entry that matters.
    await patch(memberId, { canAutoApproveBlog: true });

    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, memberId));

    const entry = rows.find(
      (r) =>
        r.entityType === "user" &&
        (r.changes as Record<string, unknown> | null)?.canAutoApproveBlog
    );

    expect(entry).toBeDefined();
    expect(entry!.action).toBe("UPDATE");
    expect(entry!.actorId).toBe(actingAdminId);
    expect(entry!.changes).toMatchObject({
      canAutoApproveBlog: { before: false, after: true },
    });

    await patch(memberId, { canAutoApproveBlog: false });
  });

  it("writes nothing when a request changes nothing", async () => {
    const before = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, memberId));

    // Same value it already holds.
    const res = await patch(memberId, { canAutoApproveBlog: false });
    expect(res.status).toBe(200);

    const after = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, memberId));

    expect(after.length).toBe(before.length);
  });
});
