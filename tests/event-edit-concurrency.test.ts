import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, events, shuls, userShuls } from "@/lib/db/schema";

/**
 * An edit racing an admin's decision.
 *
 * The window is real: applyEventEdit reads the row, then does another database
 * round trip to resolve the status, then writes. An admin approving inside that
 * window would be silently overwritten by whoever saved last — and the losing
 * write can put unreviewed text on the public calendar.
 *
 * Testing it deterministically is the hard part. A Promise.all of two callers
 * proves nothing here: neon-http gives each query its own round trip, so the
 * first finishes writing before the second reads, and the test passes against
 * an unguarded implementation. Instead the mock BELOW changes the row's status
 * as a side effect at exactly the point the real code queries the user — which
 * is precisely the window being guarded, made deterministic.
 */

const mocks = vi.hoisted(() => ({
  approveMidFlight: null as null | (() => Promise<void>),
}));

vi.mock("@/lib/submissions/auto-approve", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/submissions/auto-approve")>();
  return {
    ...original,
    resolveApprovalStatus: async (...args: Parameters<typeof original.resolveApprovalStatus>) => {
      const status = await original.resolveApprovalStatus(...args);
      // The admin acts here — after the edit read the row, before it writes.
      if (mocks.approveMidFlight) await mocks.approveMidFlight();
      return status;
    },
  };
});

const { applyEventEdit, EventEditError } = await import(
  "@/lib/events/edit-submission"
);

const stamp = Date.now();
const createdUserIds: number[] = [];
const createdEventIds: number[] = [];
const createdShulIds: number[] = [];

let ownerId: number;
let managerId: number;
let shulId: number;

async function makeEvent(userId: number | null, approvalStatus: string, linkedShul?: number) {
  const [e] = await db
    .insert(events)
    .values({
      userId,
      shulId: linkedShul ?? null,
      title: "[TEST] concurrency",
      startTime: new Date("2027-06-21T23:30:00.000Z"),
      approvalStatus,
      isActive: true,
    })
    .returning({ id: events.id });
  createdEventIds.push(e.id);
  return e.id;
}

beforeAll(async () => {
  const [owner] = await db
    .insert(users)
    .values({
      email: `test-conc-owner-${stamp}@frumtoronto.test`,
      firstName: "Test",
      lastName: "Owner",
      role: "member",
      isActive: true,
      emailVerified: new Date(),
    })
    .returning({ id: users.id });
  const [manager] = await db
    .insert(users)
    .values({
      email: `test-conc-manager-${stamp}@frumtoronto.test`,
      firstName: "Test",
      lastName: "Manager",
      role: "shul",
      isActive: true,
      emailVerified: new Date(),
    })
    .returning({ id: users.id });
  ownerId = owner.id;
  managerId = manager.id;
  createdUserIds.push(owner.id, manager.id);

  const [s] = await db
    .insert(shuls)
    .values({ name: "[TEST] Conc Shul", slug: `test-conc-shul-${stamp}` })
    .returning({ id: shuls.id });
  shulId = s.id;
  createdShulIds.push(s.id);

  await db.insert(userShuls).values({ userId: managerId, shulId });
});

afterAll(async () => {
  mocks.approveMidFlight = null;
  if (createdEventIds.length) {
    await db.delete(events).where(inArray(events.id, createdEventIds));
  }
  if (createdShulIds.length) {
    await db.delete(shuls).where(inArray(shuls.id, createdShulIds));
  }
  if (createdUserIds.length) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

describe("applyEventEdit concurrency", () => {
  it("returns 409 rather than overwriting an approval that landed mid-edit", async () => {
    const id = await makeEvent(ownerId, "pending");

    mocks.approveMidFlight = async () => {
      await db
        .update(events)
        .set({ approvalStatus: "approved" })
        .where(eq(events.id, id));
    };

    try {
      await expect(
        applyEventEdit(id, ownerId, { title: "[TEST] my edit wins?" })
      ).rejects.toMatchObject({ status: 409 });
    } finally {
      mocks.approveMidFlight = null;
    }

    // The admin's decision stands and the user's text did NOT land.
    const [row] = await db.select().from(events).where(eq(events.id, id));
    expect(row.approvalStatus).toBe("approved");
    expect(row.title).toBe("[TEST] concurrency");
  });

  it("saves normally when nothing else touches the row", async () => {
    // Positive control: an implementation that 409s on everything passes the
    // test above.
    const id = await makeEvent(ownerId, "pending");
    mocks.approveMidFlight = null;

    const result = await applyEventEdit(id, ownerId, { title: "[TEST] quiet edit" });

    expect(result.status).toBe("pending");
    const [row] = await db.select().from(events).where(eq(events.id, id));
    expect(row.title).toBe("[TEST] quiet edit");
  });

  it("raises EventEditError, so the route maps it to a real status code", async () => {
    const id = await makeEvent(ownerId, "pending");
    mocks.approveMidFlight = async () => {
      await db
        .update(events)
        .set({ approvalStatus: "rejected" })
        .where(eq(events.id, id));
    };

    try {
      await applyEventEdit(id, ownerId, { title: "[TEST] racing a rejection" });
      throw new Error("expected a conflict");
    } catch (error) {
      expect(error).toBeInstanceOf(EventEditError);
      expect((error as InstanceType<typeof EventEditError>).status).toBe(409);
    } finally {
      mocks.approveMidFlight = null;
    }
  });
});

describe("applyEventEdit ownership", () => {
  it("lets the shul's current manager edit the shul's event", async () => {
    // Institutional ownership: a gabbai leaving must not strand the shul's own
    // event. PATCH and GET run the same check.
    const id = await makeEvent(ownerId, "pending", shulId);

    const result = await applyEventEdit(
      id,
      managerId,
      { title: "[TEST] fixed by the gabbai" },
      "shul"
    );

    expect(result.id).toBe(id);
    const [row] = await db.select().from(events).where(eq(events.id, id));
    expect(row.title).toBe("[TEST] fixed by the gabbai");
  });

  it("keeps the shul's LIVE event live when its manager corrects it", async () => {
    // Everything else about their shul goes live with no review; a typo fix
    // taking the event off the calendar was the odd one out.
    const id = await makeEvent(ownerId, "approved", shulId);

    const result = await applyEventEdit(
      id,
      managerId,
      { title: "[TEST] gabbai corrected the address" },
      "shul"
    );

    expect(result.status).toBe("approved");
    expect(result.wasUnpublished).toBe(false);
    const [row] = await db.select().from(events).where(eq(events.id, id));
    expect(row.approvalStatus).toBe("approved");
  });

  it("does NOT let that manager publish an event still awaiting review", async () => {
    // Approving an event emails every community-events subscriber, and there
    // is no per-shul audience to send to instead.
    const id = await makeEvent(ownerId, "pending", shulId);

    const result = await applyEventEdit(
      id,
      managerId,
      { title: "[TEST] not live yet" },
      "shul"
    );

    expect(result.status).toBe("pending");
  });

  it("still unpublishes when the OWNER edits, manager or not", async () => {
    // The exemption is institutional, not personal — it follows the shul.
    const id = await makeEvent(ownerId, "approved", shulId);

    const result = await applyEventEdit(id, ownerId, { title: "[TEST] owner edit" });

    expect(result.status).toBe("pending_edit");
    expect(result.wasUnpublished).toBe(true);
  });

  it("still refuses a shul manager an event that is not their shul's", async () => {
    const id = await makeEvent(ownerId, "pending");

    await expect(
      applyEventEdit(id, managerId, { title: "[TEST] not yours" }, "shul")
    ).rejects.toThrow(EventEditError);
  });

  it("never lets anyone edit an unowned legacy event", async () => {
    const id = await makeEvent(null, "approved");

    await expect(
      applyEventEdit(id, ownerId, { title: "[TEST] legacy" })
    ).rejects.toThrow(EventEditError);
  });
});
