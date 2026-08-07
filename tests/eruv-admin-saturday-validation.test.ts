import { describe, it, expect, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { eruvStatus } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

// A status is stored against the Shabbos it applies to, and the public side
// looks it up by that exact date. A status saved against a Tuesday is therefore
// invisible forever -- silently. The UI offers Saturdays only, but a constrained
// UI is not a constraint, so both write paths reject non-Saturdays server-side.
//
// PATCH previously accepted any date with no validation whatsoever.

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "1", role: "admin" } })),
}));

const { POST } = await import("@/app/api/admin/eruv/route");
const { PATCH } = await import("@/app/api/admin/eruv/[id]/route");

const SATURDAY = "2031-09-06";
const TUESDAY = "2031-09-09";
const ANOTHER_SATURDAY = "2031-09-13";

const usedDates = [SATURDAY, TUESDAY, ANOTHER_SATURDAY];

afterAll(async () => {
  await db.delete(eruvStatus).where(inArray(eruvStatus.statusDate, usedDates));
});

function post(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/admin/eruv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
  );
}

function patch(id: number, body: Record<string, unknown>) {
  return PATCH(
    new Request(`http://localhost/api/admin/eruv/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ id: String(id) }) },
  );
}

describe("POST /api/admin/eruv rejects a non-Saturday", () => {
  it("accepts a Saturday", async () => {
    const res = await post({ statusDate: SATURDAY, isUp: true, message: "ok" });
    expect(res.status).toBe(201);
  });

  it("rejects a Tuesday with 400", async () => {
    const res = await post({ statusDate: TUESDAY, isUp: true });
    expect(res.status).toBe(400);

    // And nothing was written -- a rejected request must not persist.
    const rows = await db
      .select()
      .from(eruvStatus)
      .where(inArray(eruvStatus.statusDate, [TUESDAY]));
    expect(rows).toHaveLength(0);
  });

  it("rejects a malformed date with 400", async () => {
    const res = await post({ statusDate: "not-a-date", isUp: true });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/admin/eruv/[id] rejects a non-Saturday", () => {
  it("refuses to move an entry onto a Tuesday", async () => {
    const created = await post({ statusDate: ANOTHER_SATURDAY, isUp: true });
    const { id } = await created.json();

    const res = await patch(id, { statusDate: TUESDAY });
    expect(res.status).toBe(400);

    // The original date must be untouched.
    const [row] = await db
      .select()
      .from(eruvStatus)
      .where(inArray(eruvStatus.statusDate, [ANOTHER_SATURDAY]));
    expect(row.statusDate).toBe(ANOTHER_SATURDAY);
  });

  it("still allows editing other fields without a statusDate", async () => {
    const [row] = await db
      .select()
      .from(eruvStatus)
      .where(inArray(eruvStatus.statusDate, [ANOTHER_SATURDAY]));

    const res = await patch(row.id, { isUp: false, message: "wire down" });
    expect(res.status).toBe(200);
  });
});
