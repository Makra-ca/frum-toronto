import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, shivaNotifications, kosherAlerts } from "@/lib/db/schema";

/**
 * Saving an edit can email the entire subscriber list.
 *
 * This path had no coverage at all, and the suite only avoided sending because
 * RESEND_API_KEY is unset in tests — by accident, not by design.
 *
 * An auto-approver editing their OWN still-pending shiva notice resolves to
 * `approved`, which is a first publication, so setApprovalStatus announces it.
 * That is intended and matches creating with auto-approve. What must never
 * happen is the same save announcing an item that was already published.
 */

const mocks = vi.hoisted(() => ({
  sendShivaNoticeEmail: vi.fn(async () => undefined),
  sendKosherAlertBroadcast: vi.fn(async () => 0),
}));

vi.mock("@/lib/email/send", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/send")>()),
  sendShivaNoticeEmail: mocks.sendShivaNoticeEmail,
  sendKosherAlertBroadcast: mocks.sendKosherAlertBroadcast,
}));

const { applyEdit } = await import("@/lib/submissions/apply-edit");

const stamp = Date.now();
const createdUserIds: number[] = [];
const createdShiva: number[] = [];
const createdKosher: number[] = [];

let trustedId: number;
let memberId: number;

async function makeShiva(approvalStatus: string, broadcastAt: Date | null, ownerId: number) {
  const [row] = await db
    .insert(shivaNotifications)
    .values({
      userId: ownerId,
      niftarName: "[TEST] broadcast",
      mournerNames: ["[TEST]"],
      shivaStart: "2099-01-01",
      shivaEnd: "2099-01-08",
      approvalStatus,
      broadcastAt,
    })
    .returning({ id: shivaNotifications.id });
  createdShiva.push(row.id);
  return row.id;
}

async function makeKosher(approvalStatus: string, broadcastAt: Date | null, ownerId: number) {
  const [row] = await db
    .insert(kosherAlerts)
    .values({
      userId: ownerId,
      productName: "[TEST] broadcast",
      description: "[TEST] description text",
      approvalStatus,
      broadcastAt,
      isActive: true,
    })
    .returning({ id: kosherAlerts.id });
  createdKosher.push(row.id);
  return row.id;
}

beforeAll(async () => {
  const rows = await db
    .insert(users)
    .values([
      {
        email: `test-bcast-trusted-${stamp}@frumtoronto.test`,
        firstName: "Test",
        lastName: "Trusted",
        role: "member",
        isActive: true,
        emailVerified: new Date(),
        canAutoApproveShiva: true,
        canAutoApproveKosherAlerts: true,
      },
      {
        email: `test-bcast-member-${stamp}@frumtoronto.test`,
        firstName: "Test",
        lastName: "Member",
        role: "member",
        isActive: true,
        emailVerified: new Date(),
      },
    ])
    .returning({ id: users.id });
  [trustedId, memberId] = rows.map((r) => r.id);
  createdUserIds.push(...rows.map((r) => r.id));
});

beforeEach(() => {
  mocks.sendShivaNoticeEmail.mockClear();
  mocks.sendKosherAlertBroadcast.mockClear();
});

afterAll(async () => {
  if (createdShiva.length)
    await db.delete(shivaNotifications).where(inArray(shivaNotifications.id, createdShiva));
  if (createdKosher.length)
    await db.delete(kosherAlerts).where(inArray(kosherAlerts.id, createdKosher));
  if (createdUserIds.length)
    await db.delete(users).where(inArray(users.id, createdUserIds));
});

describe("editing a broadcast-capable type", () => {
  it("announces when an auto-approver's edit publishes for the first time", async () => {
    // Positive control. Without it, an implementation that never announces
    // passes every other test here.
    const id = await makeShiva("pending", null, trustedId);

    const result = await applyEdit(
      "shiva",
      id,
      trustedId,
      { shivaHours: "[TEST] 2pm-9pm" },
      "member"
    );

    expect(result.status).toBe("approved");
    expect(mocks.sendShivaNoticeEmail).toHaveBeenCalledTimes(1);
    const [row] = await db
      .select()
      .from(shivaNotifications)
      .where(eq(shivaNotifications.id, id));
    expect(row.broadcastAt).not.toBeNull();
  });

  it("does NOT re-announce a notice that was already broadcast", async () => {
    // The bereavement case: correcting an address must not re-send the notice
    // to the whole community.
    const id = await makeShiva("approved", new Date(), trustedId);

    await applyEdit("shiva", id, trustedId, { shivaHours: "[TEST] changed" }, "member");

    expect(mocks.sendShivaNoticeEmail).not.toHaveBeenCalled();
  });

  it("does not announce when an ordinary member edits", async () => {
    // Their edit resolves to pending_edit, which is not a publication.
    const id = await makeShiva("approved", null, memberId);

    const result = await applyEdit(
      "shiva",
      id,
      memberId,
      { shivaHours: "[TEST] member edit" },
      "member"
    );

    expect(result.status).toBe("pending_edit");
    expect(mocks.sendShivaNoticeEmail).not.toHaveBeenCalled();
  });

  it("does not announce a correction that an admin later re-approves", async () => {
    // The whole reason pending_edit exists, exercised through the edit path.
    const id = await makeShiva("approved", new Date(), memberId);
    await applyEdit("shiva", id, memberId, { shivaHours: "[TEST] fix" }, "member");
    mocks.sendShivaNoticeEmail.mockClear();

    const { setApprovalStatus } = await import("@/lib/submissions/set-approval-status");
    await setApprovalStatus({ type: "shiva", id, next: "approved" });

    expect(mocks.sendShivaNoticeEmail).not.toHaveBeenCalled();
  });

  it("announces a kosher alert on its first publication too", async () => {
    const id = await makeKosher("pending", null, trustedId);

    const result = await applyEdit(
      "kosherAlert",
      id,
      trustedId,
      { brand: "[TEST] brand" },
      "member"
    );

    expect(result.status).toBe("approved");
    expect(mocks.sendKosherAlertBroadcast).toHaveBeenCalledTimes(1);
  });

  it("does not re-announce a kosher alert already sent", async () => {
    const id = await makeKosher("approved", new Date(), trustedId);

    await applyEdit("kosherAlert", id, trustedId, { brand: "[TEST] fixed" }, "member");

    expect(mocks.sendKosherAlertBroadcast).not.toHaveBeenCalled();
  });
});
