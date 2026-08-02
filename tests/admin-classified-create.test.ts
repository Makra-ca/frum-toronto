import { describe, it, expect, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { classifieds } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { toDateInputValue } from "@/lib/datetime";

// Admin "+ New" for classifieds. simchas, shiva and tehillim already have one;
// classifieds was missed, and there was no POST route at all.
//
// Classifieds are the only in-scope type that EXPIRES. Getting the default
// wrong is what left the public page empty: 1,663 approved listings, every one
// past its expires_at.

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "1", role: "admin" } })),
}));

const { POST } = await import("@/app/api/admin/classifieds/route");

const createdIds: number[] = [];

async function create(body: Record<string, unknown>) {
  const res = await POST(
    new Request("http://localhost/api/admin/classifieds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never
  );
  const json = await res.json().catch(() => ({}));
  if (json?.id) createdIds.push(json.id);
  return { res, json };
}

afterAll(async () => {
  if (createdIds.length) {
    await db.delete(classifieds).where(inArray(classifieds.id, createdIds));
  }
});

describe("admin classified create", () => {
  it("creates a listing that is live immediately", async () => {
    const { res, json } = await create({
      title: "[TEST] Admin created",
      description: "body text",
    });

    expect(res.status).toBe(201);
    const [row] = await db
      .select()
      .from(classifieds)
      .where(eq(classifieds.id, json.id));
    expect(row.approvalStatus).toBe("approved");
    expect(row.isActive).toBe(true);
  });

  it("defaults to expiring 30 days out, matching the public submit form", async () => {
    const { json } = await create({
      title: "[TEST] Default expiry",
      description: "body text",
    });

    const [row] = await db
      .select()
      .from(classifieds)
      .where(eq(classifieds.id, json.id));

    const days = (row.expiresAt!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThan(31);
  });

  it("accepts an explicit expiry, so a listing can run longer", async () => {
    const wanted = "2027-03-01";

    const { json } = await create({
      title: "[TEST] Custom expiry",
      description: "body text",
      expiresAt: wanted,
    });

    const [row] = await db
      .select()
      .from(classifieds)
      .where(eq(classifieds.id, json.id));
    // End of that day in TORONTO, which is the next day in UTC — assert the
    // Toronto date, not the raw ISO string.
    expect(toDateInputValue(row.expiresAt)).toBe(wanted);
  });

  it("stamps broadcast_at so the submissions system never announces it later", async () => {
    const { json } = await create({
      title: "[TEST] Broadcast stamp",
      description: "body text",
    });

    const [row] = await db
      .select()
      .from(classifieds)
      .where(eq(classifieds.id, json.id));
    expect(row.broadcastAt).not.toBeNull();
  });

  it("requires a title and a description — both are NOT NULL", async () => {
    const { res } = await create({ description: "no title" });
    expect(res.status).toBe(400);
  });

  it("refuses a caller who is not an admin", async () => {
    const { auth } = await import("@/lib/auth/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "2", role: "member" },
    } as never);

    const { res } = await create({
      title: "[TEST] Not an admin",
      description: "body",
    });
    expect(res.status).toBe(401);
  });
});
