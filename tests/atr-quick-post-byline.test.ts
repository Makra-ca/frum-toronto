import { describe, it, expect, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";

/**
 * Quick Publish had no "Answered By" field, so the route substituted the
 * session user's name — overriding a column default that was already correct.
 * Nine published Q&As carry the wrong byline as a result ("Admin User" x9,
 * "Rabbi Bartfeld" x1) against 5,511 correctly crediting the Rav.
 */

// Hoisted: vi.mock inside it() does nothing, and the route returns 401 before
// touching the database, so an unmocked test would pass against broken code.
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
const { db } = await import("@/lib/db");
const { askTheRabbi } = await import("@/lib/db/schema");

const RAV = "Hagaon Rav Shlomo Miller Shlit'a";
const base = {
  title: "[TEST] atr byline",
  question: "q".repeat(30),
  answer: "a".repeat(30),
};

afterAll(async () => {
  // By title, not by collected id — a pre-fix run can create rows whose id
  // never reaches an array, and those would be orphaned in the test branch.
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

describe("quick post byline", () => {
  it("credits the Rav when the form sends no answeredBy", async () => {
    const res = await post(base);
    expect(res.status).toBe(201);
    const row = await res.json();

    // Fails before the fix: the route writes "Admin User" from the session,
    // overriding the answered_by column default (schema.ts:539).
    expect(row.answeredBy).toBe(RAV);
  });

  it("honours an explicit answeredBy", async () => {
    const res = await post({ ...base, answeredBy: "Rabbi Someone Else" });
    expect(res.status).toBe(201);
    const row = await res.json();
    expect(row.answeredBy).toBe("Rabbi Someone Else");
  });
});
