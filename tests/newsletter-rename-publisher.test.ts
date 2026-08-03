import { describe, it, expect, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { communityNewsletters } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

// Publisher is free text, and a typo splits a series in two: the archive
// halves, and the link already sent to readers quietly shows a subset. The
// dropdown makes typing deliberate; this makes a typo that does land fixable
// in one action rather than issue by issue.

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "1", role: "admin" } })),
}));

const { POST } = await import(
  "@/app/api/admin/community-newsletters/rename-publisher/route"
);

const createdIds: number[] = [];

async function seed(publisher: string | null, title = "[TEST] issue") {
  const [row] = await db
    .insert(communityNewsletters)
    .values({
      title,
      publisher,
      fileUrl: "https://example.com/x.pdf",
      uploadedBy: 2,
      isActive: true,
    })
    .returning({ id: communityNewsletters.id });
  createdIds.push(row.id);
  return row.id;
}

async function rename(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/admin/community-newsletters/rename-publisher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never
  );
}

const publisherOf = async (id: number) => {
  const [r] = await db
    .select()
    .from(communityNewsletters)
    .where(eq(communityNewsletters.id, id));
  return r.publisher;
};

afterAll(async () => {
  if (createdIds.length) {
    await db
      .delete(communityNewsletters)
      .where(inArray(communityNewsletters.id, createdIds));
  }
});

describe("rename publisher", () => {
  it("merges a typo'd series back into the real one", async () => {
    const good = await seed("[TEST] Israel News");
    const typo = await seed("[TEST] Isreal News");

    const res = await rename({ from: "[TEST] Isreal News", to: "[TEST] Israel News" });

    expect(res.status).toBe(200);
    expect(await publisherOf(typo)).toBe("[TEST] Israel News");
    expect(await publisherOf(good)).toBe("[TEST] Israel News");
  });

  it("renames every issue of the series, not just one", async () => {
    const a = await seed("[TEST] Old Name");
    const b = await seed("[TEST] Old Name");

    const res = await rename({ from: "[TEST] Old Name", to: "[TEST] New Name" });

    expect((await res.json()).updated).toBe(2);
    expect(await publisherOf(a)).toBe("[TEST] New Name");
    expect(await publisherOf(b)).toBe("[TEST] New Name");
  });

  it("leaves other publishers alone", async () => {
    const mine = await seed("[TEST] Mine");
    const other = await seed("[TEST] Other");

    await rename({ from: "[TEST] Mine", to: "[TEST] Renamed" });

    expect(await publisherOf(other)).toBe("[TEST] Other");
    expect(await publisherOf(mine)).toBe("[TEST] Renamed");
  });

  it("matches the stored name exactly — no fuzzy matching", async () => {
    // Israel News and Israeli News may be two real publications. Renaming must
    // never guess; the admin picks both sides explicitly.
    const near = await seed("[TEST] Israeli News");
    await seed("[TEST] Israel News");

    await rename({ from: "[TEST] Israel News", to: "[TEST] Merged" });

    expect(await publisherOf(near)).toBe("[TEST] Israeli News");
  });

  it("rejects a blank target rather than orphaning a series", async () => {
    const res = await rename({ from: "[TEST] Mine", to: "   " });
    expect(res.status).toBe(400);
  });

  it("reports when nothing matched, so a mistyped 'from' is not silent", async () => {
    const res = await rename({ from: "[TEST] Nonexistent", to: "[TEST] Whatever" });
    expect(res.status).toBe(200);
    expect((await res.json()).updated).toBe(0);
  });

  it("refuses a caller who is not an admin", async () => {
    const { auth } = await import("@/lib/auth/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "2", role: "member" },
    } as never);

    const res = await rename({ from: "a", to: "b" });
    expect(res.status).toBe(401);
  });
});
