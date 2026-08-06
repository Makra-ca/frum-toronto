import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createTestUser, cleanupTestUsers } from "./utils/test-db";

/**
 * A kosher alert must be announced at most ONCE, ever.
 *
 * Three gaps, all found in review:
 *
 * 1. `admin/kosher-alerts/[id]` "Save & Notify" emailed and never stamped.
 *    Combined with the deliberate `sendNotification: false` create path that
 *    makes a complete chain: create silently (stamp NULL by design) → Save &
 *    Notify (email #1, still NULL) → reject to fix a typo → approve →
 *    setApprovalStatus sees previous "rejected" and a NULL stamp, every guard
 *    passes → email #2 to the whole list. The `alreadyBroadcast` flag only
 *    covers the same request.
 *
 * 2 & 3. Both create paths gated the stamp on the recipient count being > 0.
 *    The count is a property of the subscriber list on the day; whether the row
 *    was announced is a property of the ROW. Zero matching subscribers left it
 *    looking un-announced — and by the next approval there may be subscribers.
 *
 * The broadcast is mocked to return 0 throughout, which is exactly the case
 * that used to skip the stamp.
 */

const broadcastSpy = vi.hoisted(() => vi.fn(async () => 0));

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: String(adminId), role: "admin", email: "test-kastamp@frumtoronto.test" },
  })),
}));
vi.mock("@/lib/email/send", () => ({
  sendKosherAlertBroadcast: broadcastSpy,
}));
vi.mock("@/lib/notifications", () => ({
  notifyAdminOfSubmission: vi.fn(async () => undefined),
  notifySubmitter: vi.fn(async () => undefined),
}));

const { POST: adminCreate } = await import("@/app/api/admin/kosher-alerts/route");
const { PATCH: adminUpdate } = await import("@/app/api/admin/kosher-alerts/[id]/route");
const { db } = await import("@/lib/db");
const { kosherAlerts } = await import("@/lib/db/schema");

const stamp = Date.now();
let adminId = 0;
const createdIds: number[] = [];

const body = (extra: Record<string, unknown> = {}) => ({
  productName: `[TEST] Product ${stamp}`,
  alertType: "recall",
  description: "[TEST] description",
  ...extra,
});

beforeAll(async () => {
  adminId = (
    await createTestUser({
      email: `test-kastamp@frumtoronto.test`,
      role: "admin",
      emailVerified: new Date(),
    })
  ).id;
});

afterAll(async () => {
  if (createdIds.length) {
    await db.delete(kosherAlerts).where(inArray(kosherAlerts.id, createdIds));
  }
  await cleanupTestUsers();
});

async function stampOf(id: number) {
  const [row] = await db
    .select({ broadcastAt: kosherAlerts.broadcastAt })
    .from(kosherAlerts)
    .where(eq(kosherAlerts.id, id));
  return row.broadcastAt;
}

describe("admin create with notify", () => {
  it("stamps even when the broadcast reached nobody", async () => {
    broadcastSpy.mockResolvedValue(0);

    const res = await adminCreate(
      new Request("http://localhost/api/admin/kosher-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body({ sendNotification: true })),
      }) as never
    );

    expect(res.status).toBe(201);
    const { alert, notificationsSent } = await res.json();
    createdIds.push(alert.id);

    expect(notificationsSent).toBe(0);
    // The load-bearing assertion: announced to nobody is still announced.
    expect(await stampOf(alert.id)).not.toBeNull();
  });
});

describe("admin Save & Notify on an existing alert", () => {
  it("stamps, so a later approve cannot announce it again", async () => {
    broadcastSpy.mockResolvedValue(5);

    // Created silently — no notification, so no stamp. That is by design.
    const created = await adminCreate(
      new Request("http://localhost/api/admin/kosher-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body({ productName: `[TEST] Silent ${stamp}` })),
      }) as never
    );
    const { alert } = await created.json();
    createdIds.push(alert.id);
    expect(await stampOf(alert.id)).toBeNull();

    // Now the admin ticks Save & Notify. This emails — so it must stamp.
    const res = await adminUpdate(
      new Request(`http://localhost/api/admin/kosher-alerts/${alert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendNotification: true }),
      }) as never,
      { params: Promise.resolve({ id: String(alert.id) }) } as never
    );

    expect(res.status).toBe(200);
    expect(broadcastSpy).toHaveBeenCalled();
    expect(await stampOf(alert.id)).not.toBeNull();
  });
});
