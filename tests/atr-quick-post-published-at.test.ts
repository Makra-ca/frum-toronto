import { describe, it, expect, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { formatInstant } from "@/lib/datetime";

/**
 * The composer collected a Published At date and sent it, but quickPostSchema
 * did not list the field — and z.object() strips unknown keys silently — so it
 * was discarded and the insert hardcoded new Date(). Backdating a Q&A failed
 * with no error.
 *
 * The date must also be parsed as a Toronto day. new Date("2026-03-14") is UTC
 * midnight, which renders as 3/13/2026 in America/Toronto.
 */

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: "1", role: "admin", name: "Admin User" },
  })),
}));
vi.mock("@/lib/auth/require-verified", () => ({
  assertCanPost: vi.fn(async () => null),
}));
vi.mock("@/lib/notifications", () => ({
  notifyAdminOfSubmission: vi.fn(async () => undefined),
}));

const { POST } = await import("@/app/api/ask-the-rabbi/quick-post/route");
const { PATCH } = await import("@/app/api/admin/ask-the-rabbi/route");
const { db } = await import("@/lib/db");
const { askTheRabbi } = await import("@/lib/db/schema");

const base = {
  title: "[TEST] atr publishedAt",
  question: "q".repeat(30),
  answer: "a".repeat(30),
};

afterAll(async () => {
  // By title: a pre-fix run returns 201 for the malformed-date case, and that
  // row's id would never reach a collected array.
  await db.delete(askTheRabbi).where(eq(askTheRabbi.title, base.title));
});

function post(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/ask-the-rabbi/quick-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never
  );
}

function patch(id: number, body: Record<string, unknown>) {
  return PATCH(
    new Request(`http://localhost/api/admin/ask-the-rabbi?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never
  );
}

const asDate = (v: unknown) =>
  formatInstant(v as string, { month: "numeric", day: "numeric", year: "numeric" });

describe("quick post publishedAt", () => {
  it("uses the date the user picked, on the Toronto day they picked", async () => {
    const res = await post({ ...base, publishedAt: "2026-03-14" });
    expect(res.status).toBe(201);
    const row = await res.json();

    // Fails before the fix: Zod strips publishedAt and the insert stamps now().
    expect(asDate(row.publishedAt)).toBe("3/14/2026");
  });

  it("defaults to now when the form sends nothing", async () => {
    const res = await post(base);
    expect(res.status).toBe(201);
    const row = await res.json();
    expect(row.publishedAt).toBeTruthy();
    expect(Number.isNaN(new Date(row.publishedAt).getTime())).toBe(false);
  });

  it("rejects a malformed date rather than storing Invalid Date", async () => {
    const res = await post({ ...base, publishedAt: "14/03/2026" });
    expect(res.status).toBe(400);
  });

  it("rejects an impossible date the regex alone would admit", async () => {
    const res = await post({ ...base, publishedAt: "2026-13-45" });
    expect(res.status).toBe(400);
  });
});

describe("editing publishedAt", () => {
  it("keeps the chosen Toronto day on the edit path too", async () => {
    const created = await (await post(base)).json();

    const res = await patch(created.id, { publishedAt: "2026-05-02" });
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(asDate(updated.publishedAt)).toBe("5/2/2026");
  });

  it("publishing with an empty date stamps now, not null", async () => {
    const created = await (await post(base)).json();
    await patch(created.id, { isPublished: false, publishedAt: null });

    const res = await patch(created.id, { isPublished: true, publishedAt: null });
    expect(res.status).toBe(200);
    const updated = await res.json();

    // Fails before the fix: the explicit-null branch runs after the
    // publish-with-no-date branch and overwrites the timestamp it just set.
    expect(updated.publishedAt).not.toBeNull();
  });
});
