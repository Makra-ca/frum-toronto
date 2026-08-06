import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestUser, cleanupTestUsers } from "./utils/test-db";

/**
 * Every field the Approvals editor offers must actually save.
 *
 * This is the test that matters, and it is not about typos. All four PATCH
 * schemas are `z.object`, which **silently strips unknown keys** — so a field
 * name that does not match produces a save that returns 200, shows "Changes
 * saved", and changes nothing. That exact failure has already shipped twice in
 * this codebase: the admin blog Reject button, and `approvalStatus` on the
 * shared update path. Both looked like they worked.
 *
 * So each field is PATCHed with a known value and read back from the database.
 * Eyeballing the schemas is not enough; only a round trip proves it.
 */

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: String(adminId), role: "admin", email: "test-apedit@frumtoronto.test" },
  })),
}));
// The simcha route calls revalidatePath, which throws outside a request
// context. Not a product bug — a test-environment one.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/notifications", () => ({
  notifyAdminOfSubmission: vi.fn(async () => undefined),
  notifySubmitter: vi.fn(async () => undefined),
}));
vi.mock("@/lib/email/send", () => ({
  sendEventLiveEmail: vi.fn(async () => undefined),
  sendShivaNoticeEmail: vi.fn(async () => undefined),
  sendKosherAlertBroadcast: vi.fn(async () => 0),
}));

const { EDITABLE_FIELDS } = await import(
  "@/components/admin/approvals/approval-edit-fields"
);
const { PATCH: patchSimcha } = await import("@/app/api/admin/simchas/[id]/route");
const { PATCH: patchTehillim } = await import("@/app/api/admin/tehillim/[id]/route");
const { PATCH: patchClassified } = await import("@/app/api/admin/classifieds/[id]/route");
const { PATCH: patchEvent } = await import("@/app/api/admin/events/[id]/route");
const { db } = await import("@/lib/db");
const { users, simchas, tehillimList, classifieds, events } = await import(
  "@/lib/db/schema"
);

const stamp = Date.now();
let adminId = 0;
let simchaId = 0;
let tehillimId = 0;
let classifiedId = 0;
let eventId = 0;

const req = (body: unknown) =>
  new Request("http://localhost/x", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;

const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) }) as never;

beforeAll(async () => {
  adminId = (
    await createTestUser({ email: `test-apedit@frumtoronto.test`, role: "admin" })
  ).id;

  [{ id: simchaId }] = await db
    .insert(simchas)
    .values({
      familyName: `[TEST] Fam ${stamp}`,
      announcement: "[TEST]",
      approvalStatus: "pending",
    })
    .returning({ id: simchas.id });

  [{ id: tehillimId }] = await db
    .insert(tehillimList)
    .values({ hebrewName: `[TEST] ${stamp}`, approvalStatus: "pending" })
    .returning({ id: tehillimList.id });

  [{ id: classifiedId }] = await db
    .insert(classifieds)
    .values({
      title: `[TEST] Item ${stamp}`,
      description: "[TEST]",
      approvalStatus: "pending",
    })
    .returning({ id: classifieds.id });

  [{ id: eventId }] = await db
    .insert(events)
    .values({
      title: `[TEST] Event ${stamp}`,
      startTime: new Date("2031-04-05T18:00:00Z"),
      approvalStatus: "pending",
      isActive: true,
    })
    .returning({ id: events.id });
});

afterAll(async () => {
  await db.delete(simchas).where(eq(simchas.id, simchaId));
  await db.delete(tehillimList).where(eq(tehillimList.id, tehillimId));
  await db.delete(classifieds).where(eq(classifieds.id, classifiedId));
  await db.delete(events).where(eq(events.id, eventId));
  await db.delete(users).where(eq(users.id, adminId));
  await cleanupTestUsers();
});

describe("every offered field actually persists", () => {
  it("simchas", async () => {
    const patch = {
      familyName: `[TEST] Corrected ${stamp}`,
      announcement: "[TEST] corrected announcement",
      eventDate: "2031-05-06",
      location: "[TEST] corrected location",
    };
    const res = await patchSimcha(req(patch), params(simchaId));
    expect(res.status).toBe(200);

    const [row] = await db.select().from(simchas).where(eq(simchas.id, simchaId));
    expect(row.familyName).toBe(patch.familyName);
    expect(row.announcement).toBe(patch.announcement);
    expect(row.location).toBe(patch.location);
    // A DATE column — must come back as the same calendar day, not shifted.
    expect(String(row.eventDate)).toContain("2031-05-06");
  });

  it("tehillim", async () => {
    const patch = {
      hebrewName: `[TEST] heb ${stamp}`,
      englishName: `[TEST] eng ${stamp}`,
      motherHebrewName: `[TEST] mother ${stamp}`,
      reason: "[TEST] refuah",
    };
    const res = await patchTehillim(req(patch), params(tehillimId));
    expect(res.status).toBe(200);

    const [row] = await db
      .select()
      .from(tehillimList)
      .where(eq(tehillimList.id, tehillimId));
    expect(row.hebrewName).toBe(patch.hebrewName);
    expect(row.englishName).toBe(patch.englishName);
    expect(row.motherHebrewName).toBe(patch.motherHebrewName);
    expect(row.reason).toBe(patch.reason);
  });

  it("classifieds", async () => {
    const patch = {
      title: `[TEST] Corrected ${stamp}`,
      description: "[TEST] corrected description",
      price: "49.99",
      location: "[TEST] Bathurst",
      contactName: "[TEST] Contact",
      contactPhone: "416-555-0000",
    };
    const res = await patchClassified(req(patch), params(classifiedId));
    expect(res.status).toBe(200);

    const [row] = await db
      .select()
      .from(classifieds)
      .where(eq(classifieds.id, classifiedId));
    expect(row.title).toBe(patch.title);
    expect(row.description).toBe(patch.description);
    // numeric(.,2) in the database, NOT the free text the Zod schema implies.
    // PATCHing "Best offer" returns `invalid input syntax for type numeric` —
    // caught by this test, which is why the field is a number input.
    expect(Number(row.price)).toBe(49.99);
    expect(row.location).toBe(patch.location);
    expect(row.contactName).toBe(patch.contactName);
    expect(row.contactPhone).toBe(patch.contactPhone);
  });

  it("events — and the full row is required, not a partial", async () => {
    // events PATCH validates with eventSchema.parse(), which is NOT partial:
    // title, startTime and isAllDay are mandatory. The dialog fetches the whole
    // row and sends it merged for exactly this reason.
    const patch = {
      title: `[TEST] Corrected Event ${stamp}`,
      description: "[TEST] corrected",
      location: "[TEST] Shaarei Shomayim",
      organization: "[TEST] Org",
      startTime: "2031-04-06T23:30:00.000Z",
      endTime: null,
      isAllDay: false,
    };
    const res = await patchEvent(req(patch), params(eventId));
    expect(res.status).toBe(200);

    const [row] = await db.select().from(events).where(eq(events.id, eventId));
    expect(row.title).toBe(patch.title);
    expect(row.description).toBe(patch.description);
    expect(row.location).toBe(patch.location);
    expect(row.organization).toBe(patch.organization);
    expect(row.startTime?.toISOString()).toBe("2031-04-06T23:30:00.000Z");
  });

  it("a partial event PATCH is rejected — proving the merge is necessary", async () => {
    // If this ever starts passing, eventSchema became partial and the dialog
    // could be simplified. Until then, sending only changed keys 400s.
    const res = await patchEvent(req({ title: "[TEST] partial only" }), params(eventId));
    expect(res.status).not.toBe(200);
  });

  it("leaves approvalStatus alone — editing is not approving", async () => {
    // The dialog deletes approvalStatus from the payload. setApprovalStatus
    // owns it, and an edit must never move an item's status as a side effect.
    const [row] = await db
      .select({ approvalStatus: events.approvalStatus })
      .from(events)
      .where(eq(events.id, eventId));
    expect(row.approvalStatus).toBe("pending");
  });
});

describe("the field config", () => {
  it("offers fields on all four tabs", () => {
    for (const type of ["simchas", "events", "classifieds", "tehillim"] as const) {
      expect(EDITABLE_FIELDS[type].length, type).toBeGreaterThan(0);
    }
  });

  it("never offers approvalStatus as an editable field", () => {
    for (const [type, fields] of Object.entries(EDITABLE_FIELDS)) {
      const names = fields.map((f) => f.name);
      expect(names, type).not.toContain("approvalStatus");
      expect(names, type).not.toContain("isActive");
    }
  });
});

describe("classifieds price is a number column, whatever the schema says", () => {
  it("rejects free text rather than saving it", async () => {
    // `price: z.string()` passes validation, then Postgres 500s. Pinned so the
    // editor never offers a text box for it again.
    const res = await patchClassified(
      req({ price: "Best offer" }),
      params(classifiedId)
    );
    expect(res.status).not.toBe(200);

    const [row] = await db
      .select({ price: classifieds.price })
      .from(classifieds)
      .where(eq(classifieds.id, classifiedId));
    expect(Number(row.price)).toBe(49.99);
  });
});
