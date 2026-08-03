import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { shulDocuments, shuls } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

// shul_documents holds tefillah sheets as well as newsletters, and the nearest
// precedent (/api/admin/shuls/[id]/documents) returns every type. This screen
// mirrors the public newsletters page, so it must not.

const mocks = vi.hoisted(() => ({
  session: { user: { id: "1", role: "admin" } } as {
    user: { id: string; role: string };
  } | null,
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => mocks.session),
}));

const { GET } = await import(
  "@/app/api/admin/community-newsletters/shul-list/route"
);

let shulId: number;
let newsletterId: number;
let tefillahId: number;
let inactiveId: number;

beforeAll(async () => {
  const [shul] = await db
    .insert(shuls)
    .values({
      name: "[TEST] Shul List Congregation",
      slug: "test-shul-list-congregation",
      isActive: true,
    })
    .returning();
  shulId = shul.id;

  const [nl, tf, off] = await db
    .insert(shulDocuments)
    .values([
      {
        shulId,
        title: "[TEST] Parshas Devarim",
        type: "newsletter",
        fileUrl: "https://example.com/n.pdf",
        isActive: true,
      },
      {
        shulId,
        title: "[TEST] Davening times",
        type: "tefillah",
        fileUrl: "https://example.com/t.pdf",
        isActive: true,
      },
      {
        shulId,
        title: "[TEST] Retired newsletter",
        type: "newsletter",
        fileUrl: "https://example.com/o.pdf",
        isActive: false,
      },
    ])
    .returning();
  newsletterId = nl.id;
  tefillahId = tf.id;
  inactiveId = off.id;
});

afterAll(async () => {
  await db
    .delete(shulDocuments)
    .where(inArray(shulDocuments.id, [newsletterId, tefillahId, inactiveId]));
  await db.delete(shuls).where(eq(shuls.id, shulId));
});

describe("GET /api/admin/community-newsletters/shul-list", () => {
  it("returns newsletters only — a tefillah must not be listed", async () => {
    mocks.session = { user: { id: "1", role: "admin" } };

    const res = await GET();
    // Proves auth let us through. Without this the route 401s, `rows` is an
    // error object, and the assertions below fail for the wrong reason.
    expect(res.status).toBe(200);

    const rows = await res.json();
    const ids = rows.map((r: { id: number }) => r.id);
    // Positive control — with no fixture, "does not contain" passes against a
    // route that returns nothing at all.
    expect(ids).toContain(newsletterId);
    expect(ids).not.toContain(tefillahId);
  });

  it("omits a deactivated newsletter", async () => {
    mocks.session = { user: { id: "1", role: "admin" } };

    const rows = await (await GET()).json();

    expect(rows.map((r: { id: number }) => r.id)).not.toContain(inactiveId);
  });

  it("carries the shul name and id, so a row can link into Shuls → Docs", async () => {
    mocks.session = { user: { id: "1", role: "admin" } };

    const rows = await (await GET()).json();
    const row = rows.find((r: { id: number }) => r.id === newsletterId);

    expect(row.shulName).toBe("[TEST] Shul List Congregation");
    expect(row.shulId).toBe(shulId);
  });

  it("refuses a caller who is not an admin", async () => {
    mocks.session = { user: { id: "2", role: "member" } };

    expect((await GET()).status).toBe(401);
  });

  it("refuses a signed-out caller", async () => {
    mocks.session = null;

    expect((await GET()).status).toBe(401);
  });
});
