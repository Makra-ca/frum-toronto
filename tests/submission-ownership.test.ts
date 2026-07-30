import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, shuls, userShuls, events } from "@/lib/db/schema";
import { createTestUser } from "./utils/test-db";
import { canEditRow } from "@/lib/submissions/ownership";

/**
 * Who may edit a submitted row.
 *
 * The interesting case is institutional, not personal: content linked to a
 * shul is editable by whoever CURRENTLY manages that shul. Personal-only
 * ownership was rejected in the spec because it produces the support email
 * most likely to arrive — a gabbai leaves, the new one cannot fix the shul's
 * own event, and the departed one still can.
 */

const stamp = Date.now();
const createdUserIds: number[] = [];
const createdShulIds: number[] = [];
const createdEventIds: number[] = [];

let ownerId: number;
let strangerId: number;
let managerId: number;
let otherManagerId: number;
let shulId: number;
let otherShulId: number;

async function makeShul(name: string) {
  const [s] = await db
    .insert(shuls)
    .values({ name, slug: `${name.toLowerCase().replace(/\s+/g, "-")}-${stamp}` })
    .returning({ id: shuls.id });
  createdShulIds.push(s.id);
  return s.id;
}

async function makeEvent(userId: number | null, linkedShulId: number | null) {
  const [e] = await db
    .insert(events)
    .values({
      userId,
      shulId: linkedShulId,
      title: "[TEST] ownership",
      startTime: new Date("2027-06-21T23:30:00.000Z"),
      approvalStatus: "approved",
      isActive: true,
    })
    .returning();
  createdEventIds.push(e.id);
  return e;
}

beforeAll(async () => {
  const owner = await createTestUser({
    email: `test-own-owner-${stamp}@frumtoronto.test`,
    role: "member",
  });
  const stranger = await createTestUser({
    email: `test-own-stranger-${stamp}@frumtoronto.test`,
    role: "member",
  });
  // canUserManageShul returns false for any role other than "shul" or "admin",
  // so a manager fixture with role "member" would make the shul branch
  // untestable while looking correct.
  const manager = await createTestUser({
    email: `test-own-manager-${stamp}@frumtoronto.test`,
    role: "shul",
  });
  const otherManager = await createTestUser({
    email: `test-own-other-${stamp}@frumtoronto.test`,
    role: "shul",
  });

  ownerId = owner.id;
  strangerId = stranger.id;
  managerId = manager.id;
  otherManagerId = otherManager.id;
  createdUserIds.push(owner.id, stranger.id, manager.id, otherManager.id);

  shulId = await makeShul("Test Shul A");
  otherShulId = await makeShul("Test Shul B");

  await db.insert(userShuls).values([
    { userId: managerId, shulId },
    { userId: otherManagerId, shulId: otherShulId },
  ]);
});

afterAll(async () => {
  // By the ids this file created, and in dependency order — the content tables
  // reference users.id with no ON DELETE, so a leftover row makes the NEXT
  // file's cleanup throw a foreign-key error and unrelated suites go red.
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

describe("canEditRow", () => {
  it("lets the owner edit their own row", async () => {
    const row = await makeEvent(ownerId, null);
    expect(await canEditRow("event", row, ownerId, "member")).toBe(true);
  });

  it("refuses a stranger", async () => {
    const row = await makeEvent(ownerId, null);
    expect(await canEditRow("event", row, strangerId, "member")).toBe(false);
  });

  it("never lets anyone edit an unowned row", async () => {
    // Every legacy-imported row has a NULL owner. Matching NULL against a
    // userId must not be truthy for anybody, including the shul manager path.
    const row = await makeEvent(null, null);
    expect(await canEditRow("event", row, ownerId, "member")).toBe(false);
    expect(await canEditRow("event", row, strangerId, "member")).toBe(false);
  });

  it("lets the shul's current manager edit someone else's event", async () => {
    const row = await makeEvent(ownerId, shulId);
    expect(await canEditRow("event", row, managerId, "shul")).toBe(true);
  });

  it("does not let a manager of a DIFFERENT shul edit it", async () => {
    const row = await makeEvent(ownerId, shulId);
    expect(await canEditRow("event", row, otherManagerId, "shul")).toBe(false);
  });

  it("does not grant shul managers a blanket pass on unlinked events", async () => {
    const row = await makeEvent(ownerId, null);
    expect(await canEditRow("event", row, managerId, "shul")).toBe(false);
  });

  it("ignores the shul branch for a type that has no shul column", async () => {
    // A simcha carries no shul_id. Reading a shulId off a row that has none
    // must not throw or accidentally grant access.
    const row = { userId: ownerId, shulId } as never;
    expect(await canEditRow("simcha", row, managerId, "shul")).toBe(false);
    expect(await canEditRow("simcha", row, ownerId, "member")).toBe(true);
  });

  it("copes with an undefined role", async () => {
    // session.user.role is string | undefined; canUserManageShul takes a
    // required string, so passing it straight through does not compile.
    const row = await makeEvent(ownerId, shulId);
    expect(await canEditRow("event", row, ownerId, undefined)).toBe(true);
    expect(await canEditRow("event", row, strangerId, undefined)).toBe(false);
  });

  it("reads the owner column the type actually uses", async () => {
    // blog_posts owns rows through author_id, not user_id. Hardcoding userId
    // would make every blog post unowned and therefore uneditable.
    const row = { authorId: ownerId } as never;
    expect(await canEditRow("blog", row, ownerId, "member")).toBe(true);
    expect(await canEditRow("blog", row, strangerId, "member")).toBe(false);
  });
});
