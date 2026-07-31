import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, events, simchas, notifications } from "@/lib/db/schema";
import { createTestUser } from "./utils/test-db";

/**
 * The single writer for approval transitions.
 *
 * Mocked at the module level and hoisted — vi.mock inside it() is NOT hoisted,
 * so the module under test would already hold the real function and a
 * "did not broadcast" assertion would pass while the whole subscriber list
 * was emailed.
 *
 * importOriginal because a bare factory replaces EVERY export of
 * @/lib/email/send, including ones unrelated to this test.
 */
const mocks = vi.hoisted(() => ({
  sendEventLiveEmail: vi.fn(async () => undefined),
  sendSubmissionOutcomeEmail: vi.fn(async () => true),
}));

vi.mock("@/lib/email/send", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/send")>()),
  sendEventLiveEmail: mocks.sendEventLiveEmail,
  sendSubmissionOutcomeEmail: mocks.sendSubmissionOutcomeEmail,
}));

const { setApprovalStatus } = await import(
  "@/lib/submissions/set-approval-status"
);

const stamp = Date.now();
const createdUserIds: number[] = [];
const createdEventIds: number[] = [];
const createdSimchaIds: number[] = [];

let ownerId: number;

async function makeEvent(
  approvalStatus: string,
  opts: { userId?: number | null; broadcastAt?: Date | null } = {}
) {
  const [e] = await db
    .insert(events)
    .values({
      userId: opts.userId === undefined ? ownerId : opts.userId,
      title: "[TEST] set-approval-status",
      startTime: new Date("2027-06-21T23:30:00.000Z"),
      approvalStatus,
      broadcastAt: opts.broadcastAt ?? null,
      isActive: true,
    })
    .returning({ id: events.id });
  createdEventIds.push(e.id);
  return e.id;
}

async function makeSimcha(approvalStatus: string) {
  const [s] = await db
    .insert(simchas)
    .values({
      userId: ownerId,
      familyName: "[TEST] Cohen",
      announcement: "[TEST] announcement",
      approvalStatus,
      isActive: true,
    })
    .returning({ id: simchas.id });
  createdSimchaIds.push(s.id);
  return s.id;
}

async function notificationsFor(userId: number) {
  return db.select().from(notifications).where(eq(notifications.userId, userId));
}

beforeAll(async () => {
  const owner = await createTestUser({
    email: `test-sas-owner-${stamp}@frumtoronto.test`,
    role: "member",
  });
  ownerId = owner.id;
  createdUserIds.push(owner.id);
});

beforeEach(async () => {
  mocks.sendEventLiveEmail.mockClear();
  mocks.sendSubmissionOutcomeEmail.mockClear();
  await db.delete(notifications).where(eq(notifications.userId, ownerId));
});

afterAll(async () => {
  await db.delete(notifications).where(inArray(notifications.userId, createdUserIds));
  if (createdEventIds.length) {
    await db.delete(events).where(inArray(events.id, createdEventIds));
  }
  if (createdSimchaIds.length) {
    await db.delete(simchas).where(inArray(simchas.id, createdSimchaIds));
  }
  if (createdUserIds.length) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

describe("setApprovalStatus", () => {
  it("broadcasts on a first approval", async () => {
    // Positive control. Without it, an implementation that never broadcasts
    // at all passes every other test in this file.
    const id = await makeEvent("pending");

    await setApprovalStatus({ type: "event", id, next: "approved" });

    expect(mocks.sendEventLiveEmail).toHaveBeenCalledTimes(1);
    const [row] = await db.select().from(events).where(eq(events.id, id));
    expect(row.approvalStatus).toBe("approved");
    expect(row.broadcastAt).not.toBeNull();
  });

  it("does NOT broadcast when a corrected item is re-approved", async () => {
    const id = await makeEvent("pending_edit", { broadcastAt: new Date() });

    await setApprovalStatus({ type: "event", id, next: "approved" });

    expect(mocks.sendEventLiveEmail).not.toHaveBeenCalled();
    const [row] = await db.select().from(events).where(eq(events.id, id));
    expect(row.approvalStatus).toBe("approved");
  });

  it("broadcasts at most once per item, ever", async () => {
    // The path a transition rule alone does NOT catch:
    //   approved (broadcast) → edit → pending_edit → REJECTED → edit → pending → approve
    // `rejected` erases the fact that the row was ever published, so the final
    // approval looks like a first one. broadcast_at is a fact about the row.
    const id = await makeEvent("pending");
    await setApprovalStatus({ type: "event", id, next: "approved" });
    expect(mocks.sendEventLiveEmail).toHaveBeenCalledTimes(1);

    await setApprovalStatus({ type: "event", id, next: "pending_edit" });
    await setApprovalStatus({ type: "event", id, next: "rejected" });
    await setApprovalStatus({ type: "event", id, next: "pending" });
    mocks.sendEventLiveEmail.mockClear();

    await setApprovalStatus({ type: "event", id, next: "approved" });

    expect(mocks.sendEventLiveEmail).not.toHaveBeenCalled();
  });

  it("never broadcasts for a type that announces to nobody", async () => {
    const id = await makeSimcha("pending");

    await setApprovalStatus({ type: "simcha", id, next: "approved" });

    expect(mocks.sendEventLiveEmail).not.toHaveBeenCalled();
    const [row] = await db.select().from(simchas).where(eq(simchas.id, id));
    expect(row.approvalStatus).toBe("approved");
  });

  it("stores the rejection reason", async () => {
    const id = await makeEvent("pending");

    await setApprovalStatus({
      type: "event",
      id,
      next: "rejected",
      rejectionReason: "Clashes with an existing listing.",
    });

    const [row] = await db.select().from(events).where(eq(events.id, id));
    expect(row.approvalStatus).toBe("rejected");
    expect(row.rejectionReason).toBe("Clashes with an existing listing.");
  });

  it("clears a stale rejection reason when the item is later approved", async () => {
    const id = await makeEvent("pending");
    await setApprovalStatus({ type: "event", id, next: "rejected", rejectionReason: "Wrong date" });

    await setApprovalStatus({ type: "event", id, next: "approved" });

    const [row] = await db.select().from(events).where(eq(events.id, id));
    expect(row.rejectionReason).toBeNull();
  });

  it("notifies the submitter on approve and on reject", async () => {
    const approvedId = await makeEvent("pending");
    await setApprovalStatus({ type: "event", id: approvedId, next: "approved" });

    let rows = await notificationsFor(ownerId);
    expect(rows.map((r) => r.type)).toEqual(["content_approved"]);

    const rejectedId = await makeEvent("pending");
    await setApprovalStatus({ type: "event", id: rejectedId, next: "rejected" });

    rows = await notificationsFor(ownerId);
    expect(rows.map((r) => r.type).sort()).toEqual([
      "content_approved",
      "content_rejected",
    ]);
    expect(mocks.sendSubmissionOutcomeEmail).toHaveBeenCalledTimes(2);
  });

  it("does not notify anyone about a move back into review", async () => {
    // The submitter hears about the ADMIN's decisions, never about their own
    // edit landing in the queue.
    const id = await makeEvent("approved");

    await setApprovalStatus({ type: "event", id, next: "pending_edit" });

    expect(await notificationsFor(ownerId)).toHaveLength(0);
    expect(mocks.sendSubmissionOutcomeEmail).not.toHaveBeenCalled();
  });

  it("approves an unowned legacy row without trying to notify anybody", async () => {
    const id = await makeEvent("pending", { userId: null });

    await setApprovalStatus({ type: "event", id, next: "approved" });

    const [row] = await db.select().from(events).where(eq(events.id, id));
    expect(row.approvalStatus).toBe("approved");
    expect(mocks.sendSubmissionOutcomeEmail).not.toHaveBeenCalled();
  });

  it("still approves when the broadcast throws", async () => {
    // A dead Resend must not leave an admin staring at a 500 and an item that
    // did not get approved.
    const id = await makeEvent("pending");
    mocks.sendEventLiveEmail.mockRejectedValueOnce(new Error("resend down"));

    await setApprovalStatus({ type: "event", id, next: "approved" });

    const [row] = await db.select().from(events).where(eq(events.id, id));
    expect(row.approvalStatus).toBe("approved");
  });

  it("still approves when the submitter notification throws", async () => {
    const id = await makeEvent("pending");
    mocks.sendSubmissionOutcomeEmail.mockRejectedValueOnce(new Error("resend down"));

    await setApprovalStatus({ type: "event", id, next: "approved" });

    const [row] = await db.select().from(events).where(eq(events.id, id));
    expect(row.approvalStatus).toBe("approved");
  });

  it("reports a missing row instead of pretending it worked", async () => {
    const result = await setApprovalStatus({
      type: "event",
      id: 999999999,
      next: "approved",
    });

    expect(result.changed).toBe(false);
    expect(mocks.sendEventLiveEmail).not.toHaveBeenCalled();
  });

  it("carries extra fields through in the same write", async () => {
    // Approving a tehillim entry can also set isPermanent; a second UPDATE
    // would be a second chance to half-apply.
    const id = await makeEvent("pending");

    await setApprovalStatus({
      type: "event",
      id,
      next: "approved",
      extraFields: { isActive: false },
    });

    const [row] = await db.select().from(events).where(eq(events.id, id));
    expect(row.approvalStatus).toBe("approved");
    expect(row.isActive).toBe(false);
  });
});
