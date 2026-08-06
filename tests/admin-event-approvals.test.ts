import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createTestUser, cleanupTestUsers } from "./utils/test-db";

/**
 * Events could not be approved from anywhere in the admin panel.
 *
 * The backend was never the problem: POST /api/admin/content/events/[id]/approve
 * and .../reject both existed, both had `events` in their typeMap, and both went
 * through setApprovalStatus. Nothing in the UI called them — approvals-client
 * passed "simchas", "classifieds" and "tehillim" and never "events". Five
 * submissions sat unreachable, including two Bais Yaakov graduations.
 *
 * This covers the two pieces of new server behaviour: the approve route reached
 * with type "events", and the `status=pending` filter the admin events page now
 * uses to find them.
 */

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: String(adminId), role: "admin", email: "test-ev-admin@frumtoronto.test" },
  })),
}));
vi.mock("@/lib/email/send", () => ({
  sendEventLiveEmail: vi.fn(async () => undefined),
  sendEventNotificationEmail: vi.fn(async () => undefined),
}));
vi.mock("@/lib/notifications", () => ({
  notifyAdminOfSubmission: vi.fn(async () => undefined),
  notifySubmitter: vi.fn(async () => undefined),
}));

const { GET: listEvents } = await import("@/app/api/admin/events/route");
const { POST: approve } = await import(
  "@/app/api/admin/content/[type]/[id]/approve/route"
);
const { db } = await import("@/lib/db");
const { events } = await import("@/lib/db/schema");

const stamp = Date.now();
let adminId = 0;
let pendingId = 0;
let pendingEditId = 0;
let pastPendingId = 0;
let approvedId = 0;
const allIds: number[] = [];

async function makeEvent(
  title: string,
  approvalStatus: string,
  startTime: Date
): Promise<number> {
  const [row] = await db
    .insert(events)
    .values({ title, startTime, approvalStatus, isActive: true })
    .returning({ id: events.id });
  allIds.push(row.id);
  return row.id;
}

const FUTURE = new Date("2032-05-10T18:00:00Z");
const PAST = new Date("2019-05-10T18:00:00Z");

beforeAll(async () => {
  adminId = (
    await createTestUser({
      email: `test-ev-admin@frumtoronto.test`,
      role: "admin",
      emailVerified: new Date(),
    })
  ).id;

  pendingId = await makeEvent(`[TEST] Pending ${stamp}`, "pending", FUTURE);
  pendingEditId = await makeEvent(`[TEST] Edited ${stamp}`, "pending_edit", FUTURE);
  pastPendingId = await makeEvent(`[TEST] Past Pending ${stamp}`, "pending", PAST);
  approvedId = await makeEvent(`[TEST] Approved ${stamp}`, "approved", FUTURE);
});

afterAll(async () => {
  if (allIds.length) await db.delete(events).where(inArray(events.id, allIds));
  await cleanupTestUsers();
});

describe("status=pending on /api/admin/events", () => {
  it("returns pending AND pending_edit", async () => {
    // A literal === "pending" would leave every corrected submission
    // permanently unreviewable, which is the same class of bug as the one this
    // whole change fixes.
    const res = await listEvents(
      new Request("http://localhost/api/admin/events?status=pending") as never
    );
    expect(res.status).toBe(200);

    const ids: number[] = (await res.json()).map((e: { id: number }) => e.id);
    expect(ids).toContain(pendingId);
    expect(ids).toContain(pendingEditId);
    expect(ids).not.toContain(approvedId);
  });

  it("includes a pending event whose date has already passed", async () => {
    // Deliberately not time-filtered. An event stuck in the queue past its own
    // date is exactly the one nobody noticed.
    const res = await listEvents(
      new Request("http://localhost/api/admin/events?status=pending") as never
    );
    const ids: number[] = (await res.json()).map((e: { id: number }) => e.id);
    expect(ids).toContain(pastPendingId);
  });

  it("leaves the existing time filters alone", async () => {
    const upcoming = await listEvents(
      new Request("http://localhost/api/admin/events?status=upcoming") as never
    );
    const upcomingIds: number[] = (await upcoming.json()).map(
      (e: { id: number }) => e.id
    );
    expect(upcomingIds).toContain(pendingId);
    expect(upcomingIds).not.toContain(pastPendingId);

    const past = await listEvents(
      new Request("http://localhost/api/admin/events?status=past") as never
    );
    const pastIds: number[] = (await past.json()).map((e: { id: number }) => e.id);
    expect(pastIds).toContain(pastPendingId);
    expect(pastIds).not.toContain(pendingId);
  });
});

describe("approving an event", () => {
  const call = (id: number) =>
    approve(
      new Request(`http://localhost/api/admin/content/events/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }) as never,
      { params: Promise.resolve({ type: "events", id: String(id) }) } as never
    );

  it("works through the shared route with type 'events'", async () => {
    const res = await call(pendingId);
    expect(res.status).toBe(200);

    const [row] = await db
      .select({ approvalStatus: events.approvalStatus, broadcastAt: events.broadcastAt })
      .from(events)
      .where(eq(events.id, pendingId));

    expect(row.approvalStatus).toBe("approved");
    // First approval of a never-published event: the broadcast is claimed.
    expect(row.broadcastAt).not.toBeNull();
  });

  it("does not re-broadcast a corrected submission", async () => {
    // pending_edit means the item was already published once. Re-approving it
    // must not email the subscriber list again — for a shiva notice that would
    // mean re-sending a bereavement notice because someone fixed an address.
    const res = await call(pendingEditId);
    expect(res.status).toBe(200);

    const [row] = await db
      .select({ approvalStatus: events.approvalStatus, broadcastAt: events.broadcastAt })
      .from(events)
      .where(eq(events.id, pendingEditId));

    expect(row.approvalStatus).toBe("approved");
    expect(row.broadcastAt).toBeNull();
  });

  it("does not broadcast twice when approved again", async () => {
    const [before] = await db
      .select({ broadcastAt: events.broadcastAt })
      .from(events)
      .where(eq(events.id, pendingId));

    await call(pendingId);

    const [after] = await db
      .select({ broadcastAt: events.broadcastAt })
      .from(events)
      .where(eq(events.id, pendingId));

    expect(after.broadcastAt?.getTime()).toBe(before.broadcastAt?.getTime());
  });
});
