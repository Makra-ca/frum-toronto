import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { events, users } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { applyEventEdit, EventEditError } from "@/lib/events/edit-submission";

// Users editing their own event submissions.
//
// An edit to an already-approved event unpublishes it for re-review — but as
// `pending_edit`, never `pending`. The distinction is the whole mechanism:
// every broadcast guard fires on `pending → approved`, so an edit that set
// `pending` would mean correcting a typo re-emails the entire subscriber list
// when an admin re-approves.
//
// An auto-approver's edit stays live. Their permission means "your posts go
// live without review"; unpublishing them on edit silently revokes it, and an
// admin editing their own event would have to ask someone else to restore it.

let ownerId: number;
let strangerId: number;
let trustedId: number;
let adminId: number;
const createdEventIds: number[] = [];

async function makeUser(
  email: string,
  extra: Partial<typeof users.$inferInsert> = {}
) {
  const [u] = await db
    .insert(users)
    .values({
      email,
      firstName: "Test",
      lastName: "User",
      role: "member",
      isActive: true,
      emailVerified: new Date(),
      ...extra,
    })
    .returning({ id: users.id });
  return u.id;
}

async function makeEvent(userId: number, approvalStatus: string) {
  const [e] = await db
    .insert(events)
    .values({
      userId,
      title: "Original title",
      startTime: new Date("2027-06-21T23:30:00.000Z"),
      approvalStatus,
      isActive: true,
    })
    .returning({ id: events.id });
  createdEventIds.push(e.id);
  return e.id;
}

beforeAll(async () => {
  ownerId = await makeUser(`test-owner-${Date.now()}@frumtoronto.test`);
  strangerId = await makeUser(`test-stranger-${Date.now()}@frumtoronto.test`);
  trustedId = await makeUser(`test-trusted-${Date.now()}@frumtoronto.test`, {
    canAutoApproveEvents: true,
  });
  adminId = await makeUser(`test-admin-${Date.now()}@frumtoronto.test`, {
    role: "admin",
  });
});

afterAll(async () => {
  if (createdEventIds.length) {
    await db.delete(events).where(inArray(events.id, createdEventIds));
  }
  await db
    .delete(users)
    .where(inArray(users.id, [ownerId, strangerId, trustedId, adminId]));
});

describe("applyEventEdit", () => {
  it("lets the owner change their own pending event", async () => {
    const id = await makeEvent(ownerId, "pending");

    await applyEventEdit(id, ownerId, { title: "Corrected title" });

    const [row] = await db.select().from(events).where(eq(events.id, id));
    expect(row.title).toBe("Corrected title");
  });

  it("unpublishes a live event as pending_edit, NOT pending", async () => {
    const id = await makeEvent(ownerId, "approved");

    const result = await applyEventEdit(id, ownerId, {
      title: "Changed after approval",
    });

    const [row] = await db.select().from(events).where(eq(events.id, id));
    expect(row.title).toBe("Changed after approval");
    // `pending` here would make the admin's re-approval look like a first
    // approval to every broadcast guard.
    expect(row.approvalStatus).toBe("pending_edit");
    expect(result.status).toBe("pending_edit");
  });

  it("keeps pending_edit on a second edit before anyone reviews it", async () => {
    const id = await makeEvent(ownerId, "approved");

    await applyEventEdit(id, ownerId, { title: "First correction" });
    const second = await applyEventEdit(id, ownerId, { title: "Second correction" });

    expect(second.status).toBe("pending_edit");
  });

  it("leaves an auto-approver's live event live", async () => {
    const id = await makeEvent(trustedId, "approved");

    const result = await applyEventEdit(
      id,
      trustedId,
      { title: "Trusted correction" },
      "member"
    );

    const [row] = await db.select().from(events).where(eq(events.id, id));
    expect(row.approvalStatus).toBe("approved");
    expect(result.status).toBe("approved");
    // Nothing came off the calendar, so the user must not be told it did.
    expect(result.wasUnpublished).toBe(false);
  });

  it("leaves an admin's live event live", async () => {
    const id = await makeEvent(adminId, "approved");

    const result = await applyEventEdit(
      id,
      adminId,
      { title: "Admin correction" },
      "admin"
    );

    expect(result.status).toBe("approved");
  });

  it("does not let an auto-approver republish rejected content by editing", async () => {
    // A rejection is an admin decision; the edit path must not overturn it.
    const id = await makeEvent(trustedId, "rejected");

    const result = await applyEventEdit(
      id,
      trustedId,
      { title: "Sneaking it back" },
      "member"
    );

    expect(result.status).toBe("pending");
  });

  it("refuses an edit from someone who does not own the event", async () => {
    const id = await makeEvent(ownerId, "pending");

    await expect(
      applyEventEdit(id, strangerId, { title: "Hijacked" })
    ).rejects.toThrow(EventEditError);

    const [row] = await db.select().from(events).where(eq(events.id, id));
    expect(row.title).toBe("Original title");
  });

  it("refuses an edit to an event that does not exist", async () => {
    await expect(
      applyEventEdit(999999999, ownerId, { title: "Ghost" })
    ).rejects.toThrow(EventEditError);
  });

  it("reports whether the edit removed the event from public view", async () => {
    const approved = await makeEvent(ownerId, "approved");
    const pending = await makeEvent(ownerId, "pending");

    const fromApproved = await applyEventEdit(approved, ownerId, { title: "A" });
    const fromPending = await applyEventEdit(pending, ownerId, { title: "B" });

    expect(fromApproved.wasUnpublished).toBe(true);
    expect(fromPending.wasUnpublished).toBe(false);
  });

  it("does not let an edit change ownership", async () => {
    const id = await makeEvent(ownerId, "pending");

    await applyEventEdit(id, ownerId, {
      title: "Still mine",
      // a hostile client trying to reassign the row
      userId: strangerId,
      converted: true,
    } as never);

    const [row] = await db.select().from(events).where(eq(events.id, id));
    expect(row.userId).toBe(ownerId);
  });
});
