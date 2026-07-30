import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { events, users } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { applyEventEdit, EventEditError } from "@/lib/events/edit-submission";

// POC: users editing their own event submissions.
//
// Policy decided with the owner: an edit to an already-approved event sends it
// back to `pending`, so nothing reaches the public without review.

let ownerId: number;
let strangerId: number;
const createdEventIds: number[] = [];

async function makeUser(email: string) {
  const [u] = await db
    .insert(users)
    .values({ email, firstName: "Test", lastName: "User", role: "member", isActive: true, emailVerified: new Date() })
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
});

afterAll(async () => {
  if (createdEventIds.length) {
    await db.delete(events).where(inArray(events.id, createdEventIds));
  }
  await db.delete(users).where(inArray(users.id, [ownerId, strangerId]));
});

describe("applyEventEdit", () => {
  it("lets the owner change their own pending event", async () => {
    const id = await makeEvent(ownerId, "pending");

    await applyEventEdit(id, ownerId, { title: "Corrected title" });

    const [row] = await db.select().from(events).where(eq(events.id, id));
    expect(row.title).toBe("Corrected title");
  });

  it("sends an approved event back to pending when it is edited", async () => {
    const id = await makeEvent(ownerId, "approved");

    await applyEventEdit(id, ownerId, { title: "Changed after approval" });

    const [row] = await db.select().from(events).where(eq(events.id, id));
    expect(row.title).toBe("Changed after approval");
    expect(row.approvalStatus).toBe("pending");
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
