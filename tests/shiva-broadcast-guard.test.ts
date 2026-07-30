import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { shivaNotifications } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

// Re-approving a CORRECTED shiva notice must not re-announce a bereavement to
// the entire community.
//
// Traps this test exists to avoid, all of which produce a green run against
// broken code:
//   - the route returns 401 before touching the DB, so with no session mocked
//     "no email was sent" is trivially true;
//   - `vi.mock` inside `it()` is not hoisted, so the route keeps the real module;
//   - a factory mock replaces every export of @/lib/email/send, so use importOriginal;
//   - without a positive control, an implementation that never broadcasts at all
//     passes every exclusion case here.

const mocks = vi.hoisted(() => ({
  sendShivaNoticeEmail: vi.fn(async () => true),
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "1", role: "admin" } })),
}));

vi.mock("@/lib/email/send", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/send")>()),
  sendShivaNoticeEmail: mocks.sendShivaNoticeEmail,
}));

const { PATCH } = await import("@/app/api/admin/shiva/[id]/route");

const createdIds: number[] = [];

async function makeNotice(approvalStatus: string) {
  const [row] = await db
    .insert(shivaNotifications)
    .values({
      niftarName: "[TEST] Broadcast Guard",
      shivaStart: "2027-01-01",
      shivaEnd: "2027-01-08",
      approvalStatus,
    })
    .returning({ id: shivaNotifications.id });
  createdIds.push(row.id);
  return row.id;
}

async function approve(id: number) {
  return PATCH(
    new Request(`http://localhost/api/admin/shiva/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalStatus: "approved" }),
    }) as never,
    { params: Promise.resolve({ id: String(id) }) }
  );
}

afterAll(async () => {
  if (createdIds.length) {
    await db
      .delete(shivaNotifications)
      .where(inArray(shivaNotifications.id, createdIds));
  }
});

describe("shiva broadcast guard", () => {
  it("DOES broadcast on a first approval — positive control", async () => {
    const id = await makeNotice("pending");
    mocks.sendShivaNoticeEmail.mockClear();

    const res = await approve(id);

    expect(res.status).toBe(200);
    expect(mocks.sendShivaNoticeEmail).toHaveBeenCalledTimes(1);
  });

  it("does NOT broadcast when a corrected notice is re-approved", async () => {
    const id = await makeNotice("pending_edit");
    mocks.sendShivaNoticeEmail.mockClear();

    const res = await approve(id);

    // Proves auth and validation let us through — without this the assertion
    // below passes on a 401.
    expect(res.status).toBe(200);

    // Proves the approval actually happened — "no broadcast" is meaningless
    // if nothing was approved.
    const [row] = await db
      .select()
      .from(shivaNotifications)
      .where(eq(shivaNotifications.id, id));
    expect(row.approvalStatus).toBe("approved");

    expect(mocks.sendShivaNoticeEmail).not.toHaveBeenCalled();
  });
});
