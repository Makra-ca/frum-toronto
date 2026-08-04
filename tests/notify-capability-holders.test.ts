import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { inArray } from "drizzle-orm";
import { createTestUser, cleanupTestUsers } from "./utils/test-db";

/**
 * createAdminNotification targeted `role = "admin"` and nothing else, so the
 * one person holding canManageAskTheRabbi got a working submissions inbox and
 * no signal that anything landed in it. The three linkUrls also point at
 * /admin, which middleware bounces him from.
 *
 * Recipients are now admins ∪ holders of the capability that governs that
 * content type, and each audience gets a link it can actually open.
 */

vi.mock("@/lib/email/resend", () => ({
  resend: null, // no outbound mail from tests
  EMAIL_FROM: "test@frumtoronto.test",
}));

const { db } = await import("@/lib/db");
const { notifications } = await import("@/lib/db/schema");
const {
  resolveNotificationRecipients,
  linkForRecipient,
  CAPABILITY_BY_CONTENT,
} = await import("@/lib/notifications");

let adminId: number;
let holderId: number;
let plainId: number;

beforeAll(async () => {
  adminId = (
    await createTestUser({ email: "test-notify-admin@frumtoronto.test", role: "admin" })
  ).id;
  holderId = (
    await createTestUser({
      email: "test-notify-holder@frumtoronto.test",
      role: "member",
      canManageAskTheRabbi: true,
    })
  ).id;
  plainId = (
    await createTestUser({ email: "test-notify-plain@frumtoronto.test", role: "member" })
  ).id;
});

afterAll(async () => {
  await db.delete(notifications).where(inArray(notifications.userId, [adminId, holderId, plainId]));
  await cleanupTestUsers();
});

describe("who gets notified", () => {
  it("includes the capability holder for an Ask the Rabbi submission", async () => {
    const rec = await resolveNotificationRecipients("ask_the_rabbi");
    const ids = rec.map((r) => r.id);

    // Fails before the fix: only admins were ever returned.
    expect(ids).toContain(holderId);
    expect(ids).toContain(adminId);
    expect(ids).not.toContain(plainId);
  });

  it("covers all three Ask the Rabbi content types", async () => {
    for (const type of ["ask_the_rabbi", "atr_comment", "atr_quick_post"] as const) {
      const ids = (await resolveNotificationRecipients(type)).map((r) => r.id);
      expect(ids, `${type} should reach the holder`).toContain(holderId);
    }
  });

  it("returns admins only for a type with no capability mapped", async () => {
    const ids = (await resolveNotificationRecipients("shiva")).map((r) => r.id);
    expect(ids).toContain(adminId);
    expect(ids).not.toContain(holderId);
  });

  it("does not duplicate an admin who also holds the capability", async () => {
    const both = await createTestUser({
      email: "test-notify-both@frumtoronto.test",
      role: "admin",
      canManageAskTheRabbi: true,
    });
    const ids = (await resolveNotificationRecipients("ask_the_rabbi")).map((r) => r.id);
    expect(ids.filter((i) => i === both.id)).toHaveLength(1);
  });

  it("skips a blocked account", async () => {
    const blocked = await createTestUser({
      email: "test-notify-blocked@frumtoronto.test",
      role: "member",
      canManageAskTheRabbi: true,
      isActive: false,
    });
    const ids = (await resolveNotificationRecipients("ask_the_rabbi")).map((r) => r.id);
    expect(ids).not.toContain(blocked.id);
  });
});

describe("which link each audience gets", () => {
  const adminLink = "/admin/programs/rabbi?tab=submissions";

  it("gives an admin the admin link", () => {
    expect(linkForRecipient({ isAdmin: true }, adminLink, "ask_the_rabbi")).toBe(adminLink);
  });

  it("gives a non-admin holder a link they can actually open", () => {
    // Middleware bounces a member from /admin, so the admin URL would be a
    // dead end for the very person the notification exists to reach.
    const link = linkForRecipient({ isAdmin: false }, adminLink, "ask_the_rabbi");
    expect(link).toBe("/dashboard/ask-the-rabbi?tab=submissions");
    expect(link.startsWith("/admin")).toBe(false);
  });

  it("falls back to the admin link when no alternative is known", () => {
    expect(linkForRecipient({ isAdmin: false }, "/admin/approvals", "shiva")).toBe(
      "/admin/approvals"
    );
  });
});

describe("the capability map", () => {
  it("maps only the Ask the Rabbi types", () => {
    expect(Object.keys(CAPABILITY_BY_CONTENT).sort()).toEqual(
      ["ask_the_rabbi", "atr_comment", "atr_quick_post"].sort()
    );
  });
});
