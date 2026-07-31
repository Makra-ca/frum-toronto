import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, events } from "@/lib/db/schema";

/**
 * What the submitter is TOLD, and what the admin is told, after an edit.
 *
 * Both messages used to be chosen by `wasUnpublished`, which was hardcoded to
 * "an approved event was edited". So a trusted user — whose event never leaves
 * the calendar — was told it had been removed, and the admin was told the same.
 * The status is now resolved first and every message reads it.
 */

const mocks = vi.hoisted(() => ({
  session: {
    user: { id: "0", role: "member", email: "x@y.z", name: "Tester" },
  } as { user: { id: string; role: string; email: string; name: string } },
  notifyAdminOfSubmission: vi.fn(async () => undefined),
  notifyAdminOfTrustedEdit: vi.fn(async () => undefined),
}));

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn(async () => mocks.session) }));

// revalidatePath throws outside a request context.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notifications")>()),
  notifyAdminOfSubmission: mocks.notifyAdminOfSubmission,
  notifyAdminOfTrustedEdit: mocks.notifyAdminOfTrustedEdit,
}));

const { PATCH } = await import("@/app/api/community/events/[id]/route");

const stamp = Date.now();
const createdUserIds: number[] = [];
const createdEventIds: number[] = [];

let memberId: number;
let trustedId: number;

async function makeUser(email: string, extra: Partial<typeof users.$inferInsert> = {}) {
  const [u] = await db
    .insert(users)
    .values({
      email,
      firstName: "Test",
      lastName: "User",
      role: "member",
      isActive: true,
      // assertCanPost refuses an unverified account, so an unverified fixture
      // would make every case below fail with a 403 for the wrong reason.
      emailVerified: new Date(),
      ...extra,
    })
    .returning({ id: users.id });
  createdUserIds.push(u.id);
  return u.id;
}

async function makeEvent(userId: number, approvalStatus: string) {
  const [e] = await db
    .insert(events)
    .values({
      userId,
      title: "[TEST] route copy",
      startTime: new Date("2027-06-21T23:30:00.000Z"),
      approvalStatus,
      isActive: true,
    })
    .returning({ id: events.id });
  createdEventIds.push(e.id);
  return e.id;
}

async function patch(id: number, title: string) {
  return PATCH(
    new Request(`http://localhost/api/community/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        startTime: "2027-06-21T23:30:00.000Z",
        contactName: "Tester",
      }),
    }) as never,
    { params: Promise.resolve({ id: String(id) }) }
  );
}

beforeAll(async () => {
  memberId = await makeUser(`test-evroute-member-${stamp}@frumtoronto.test`);
  trustedId = await makeUser(`test-evroute-trusted-${stamp}@frumtoronto.test`, {
    canAutoApproveEvents: true,
  });
});

beforeEach(() => {
  mocks.notifyAdminOfSubmission.mockClear();
  mocks.notifyAdminOfTrustedEdit.mockClear();
});

afterAll(async () => {
  if (createdEventIds.length) {
    await db.delete(events).where(inArray(events.id, createdEventIds));
  }
  if (createdUserIds.length) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

describe("PATCH /api/community/events/[id]", () => {
  it("tells an ordinary member their live event came off the calendar", async () => {
    mocks.session.user = {
      id: String(memberId),
      role: "member",
      email: "m@x.test",
      name: "Member",
    };
    const id = await makeEvent(memberId, "approved");

    const res = await patch(id, "[TEST] corrected by member");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("pending_edit");
    expect(body.message).toContain("removed from the calendar");

    const [row] = await db.select().from(events).where(eq(events.id, id));
    expect(row.approvalStatus).toBe("pending_edit");
    expect(mocks.notifyAdminOfTrustedEdit).not.toHaveBeenCalled();
  });

  it("tells an auto-approver their event is still on the calendar", async () => {
    mocks.session.user = {
      id: String(trustedId),
      role: "member",
      email: "t@x.test",
      name: "Trusted",
    };
    const id = await makeEvent(trustedId, "approved");

    const res = await patch(id, "[TEST] corrected by trusted");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("approved");
    expect(body.message).toContain("still on the calendar");
    // The old copy said the opposite of what happened.
    expect(body.message).not.toContain("removed");

    const [row] = await db.select().from(events).where(eq(events.id, id));
    expect(row.approvalStatus).toBe("approved");
  });

  it("records a trail when an auto-approver edits live content", async () => {
    mocks.session.user = {
      id: String(trustedId),
      role: "member",
      email: "t@x.test",
      name: "Trusted",
    };
    const id = await makeEvent(trustedId, "approved");

    await patch(id, "[TEST] quietly changed");

    // The spec's sole mitigation for letting these edits stay live.
    expect(mocks.notifyAdminOfTrustedEdit).toHaveBeenCalledTimes(1);
    expect(mocks.notifyAdminOfSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ status: "auto_approved" })
    );
  });

  it("still tells a member with a pending event that it is awaiting approval", async () => {
    mocks.session.user = {
      id: String(memberId),
      role: "member",
      email: "m@x.test",
      name: "Member",
    };
    const id = await makeEvent(memberId, "pending");

    const res = await patch(id, "[TEST] fixing before review");
    const body = await res.json();

    expect(body.status).toBe("pending");
    expect(body.message).toContain("awaiting approval");
  });
});
