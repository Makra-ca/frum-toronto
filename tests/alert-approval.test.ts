import { describe, it, expect, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { alerts } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

// `alerts` is a submission type — a member can post one and it lands pending —
// but its admin PATCH schema had no `approvalStatus` field, and `alerts` is
// absent from the shared approve route's tableMap. So a pending alert could
// never be approved through any admin surface, and the public page filters on
// `approved`. Submitted alerts were unreachable.

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "1", role: "admin" } })),
}));

const { PATCH } = await import("@/app/api/admin/alerts/[id]/route");

const createdIds: number[] = [];

async function makeAlert(approvalStatus: string) {
  const [row] = await db
    .insert(alerts)
    .values({
      title: "[TEST] Approvable alert",
      content: "body",
      alertType: "general",
      approvalStatus,
    })
    .returning({ id: alerts.id });
  createdIds.push(row.id);
  return row.id;
}

async function patch(id: number, body: Record<string, unknown>) {
  return PATCH(
    new Request(`http://localhost/api/admin/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ id: String(id) }) }
  );
}

afterAll(async () => {
  if (createdIds.length) {
    await db.delete(alerts).where(inArray(alerts.id, createdIds));
  }
});

describe("admin alert approval", () => {
  it("can approve a pending alert", async () => {
    const id = await makeAlert("pending");

    const res = await patch(id, { approvalStatus: "approved" });

    expect(res.status).toBe(200);
    const [row] = await db.select().from(alerts).where(eq(alerts.id, id));
    expect(row.approvalStatus).toBe("approved");
  });

  it("can approve an alert its owner has corrected", async () => {
    const id = await makeAlert("pending_edit");

    const res = await patch(id, { approvalStatus: "approved" });

    expect(res.status).toBe(200);
    const [row] = await db.select().from(alerts).where(eq(alerts.id, id));
    expect(row.approvalStatus).toBe("approved");
  });

  it("rejects a status the system does not use", async () => {
    const id = await makeAlert("pending");

    const res = await patch(id, { approvalStatus: "banana" });

    expect(res.status).toBe(400);
    const [row] = await db.select().from(alerts).where(eq(alerts.id, id));
    expect(row.approvalStatus).toBe("pending");
  });

  it("still updates ordinary fields", async () => {
    const id = await makeAlert("approved");

    const res = await patch(id, { title: "[TEST] Renamed" });

    expect(res.status).toBe(200);
    const [row] = await db.select().from(alerts).where(eq(alerts.id, id));
    expect(row.title).toBe("[TEST] Renamed");
    expect(row.approvalStatus).toBe("approved");
  });
});
