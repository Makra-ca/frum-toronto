import { describe, it, expect, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { communityNewsletters } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { toDateInputValue } from "@/lib/datetime";

// `published_at` existed on the table and in the orderBy, but was not a form
// field and not in either API schema — it fell back to defaultNow(). So a
// backlog uploaded in one sitting shared a minute and ordered by upload, and
// "Week of Aug 3" could not be entered at all.

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "1", role: "admin" } })),
}));

const { POST } = await import("@/app/api/admin/community-newsletters/route");
const { PATCH } = await import("@/app/api/admin/community-newsletters/[id]/route");

const createdIds: number[] = [];

async function create(body: Record<string, unknown>) {
  const res = await POST(
    new Request("http://localhost/api/admin/community-newsletters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "[TEST] Newsletter",
        fileUrl: "https://example.com/x.pdf",
        ...body,
      }),
    }) as never
  );
  const json = await res.json().catch(() => ({}));
  if (json?.id) createdIds.push(json.id);
  return { res, json };
}

async function patch(id: number, body: Record<string, unknown>) {
  return PATCH(
    new Request(`http://localhost/api/admin/community-newsletters/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ id: String(id) }) }
  );
}

const read = async (id: number) => {
  const [r] = await db
    .select()
    .from(communityNewsletters)
    .where(eq(communityNewsletters.id, id));
  return r;
};

afterAll(async () => {
  if (createdIds.length) {
    await db
      .delete(communityNewsletters)
      .where(inArray(communityNewsletters.id, createdIds));
  }
});

describe("community newsletter publication date", () => {
  it("stores an explicit issue date", async () => {
    const { res, json } = await create({ publishedAt: "2026-08-03" });

    expect(res.status).toBe(201);
    // Asserted as a Toronto calendar day, not a raw ISO string — the stored
    // instant is noon Toronto, which is a different UTC date in winter.
    expect(toDateInputValue((await read(json.id)).publishedAt)).toBe("2026-08-03");
  });

  it("falls back to now when no date is given", async () => {
    const { json } = await create({});
    expect((await read(json.id)).publishedAt).not.toBeNull();
  });

  it("accepts an explicitly empty date rather than erroring", async () => {
    // The form sends "" whenever the field is left blank. new Date("") is an
    // Invalid Date, which would fail the insert — so the key is sent, not omitted.
    const { res } = await create({ publishedAt: "" });
    expect(res.status).toBe(201);
  });

  it("updates the date on an existing newsletter", async () => {
    const { json } = await create({ publishedAt: "2026-08-03" });

    const res = await patch(json.id, { publishedAt: "2026-07-27" });

    expect(res.status).toBe(200);
    expect(toDateInputValue((await read(json.id)).publishedAt)).toBe("2026-07-27");
  });

  it("clears the date when sent explicitly empty", async () => {
    // `undefined` in a Drizzle .set() means leave unchanged, so without an
    // explicit null a date could never be removed once set.
    const { json } = await create({ publishedAt: "2026-08-03" });

    await patch(json.id, { publishedAt: "" });

    expect((await read(json.id)).publishedAt).toBeNull();
  });

  it("still rejects an empty PATCH with 400, not 500", async () => {
    // An unconditional `publishedAt` key would mean the updates object is
    // never empty: the 400 guard is bypassed, Drizzle strips the undefined
    // and throws, and the caller gets a 500.
    const { json } = await create({});

    const res = await patch(json.id, {});

    expect(res.status).toBe(400);
  });
});
