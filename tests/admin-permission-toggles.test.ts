import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray, getTableColumns } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * Every auto-approve toggle survives a round trip through the admin API.
 *
 * `canAutoApproveBlog` existed in the database from the day the blog system
 * shipped, but was in neither the permissions dialog nor this route — so the
 * only way to grant it was raw SQL. Worse, adding it to the dialog alone would
 * not have helped: the route destructures named fields, so an unlisted one is
 * dropped silently and the UI still reports success.
 *
 * Driven from the real columns, so a flag added to the schema and forgotten
 * here fails rather than shipping as a switch that does nothing.
 */

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "1", role: "admin" } })),
}));

const { PATCH } = await import("@/app/api/admin/users/[id]/route");

const stamp = Date.now();
const createdUserIds: number[] = [];
let subjectId: number;

/** Every canAutoApprove* column the schema actually has. */
const FLAGS = Object.keys(getTableColumns(users)).filter((c) =>
  c.startsWith("canAutoApprove")
);

async function patch(id: number, body: Record<string, unknown>) {
  return PATCH(
    new Request(`http://localhost/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ id: String(id) }) }
  ) as Promise<Response>;
}

beforeAll(async () => {
  const [u] = await db
    .insert(users)
    .values({
      email: `test-toggles-${stamp}@frumtoronto.test`,
      firstName: "Test",
      lastName: "Subject",
      role: "member",
      isActive: true,
    })
    .returning({ id: users.id });
  subjectId = u.id;
  createdUserIds.push(u.id);
});

afterAll(async () => {
  if (createdUserIds.length) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

describe("admin permission toggles", () => {
  it("has a flag for each of the twelve content types", () => {
    // Guards against the list shrinking silently.
    expect(FLAGS.length).toBe(12);
    expect(FLAGS).toContain("canAutoApproveBlog");
  });

  it.each(FLAGS)("%s can be granted through the API", async (flag) => {
    const res = await patch(subjectId, { [flag]: true });

    expect(res.status).toBe(200);
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.id, subjectId));
    // The assertion that matters: the route destructures named fields, so an
    // unlisted flag is silently dropped and the response is still a 200.
    expect((row as unknown as Record<string, unknown>)[flag]).toBe(true);
  });

  it.each(FLAGS)("%s can be taken away again", async (flag) => {
    await patch(subjectId, { [flag]: true });
    const res = await patch(subjectId, { [flag]: false });

    expect(res.status).toBe(200);
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.id, subjectId));
    expect((row as unknown as Record<string, unknown>)[flag]).toBe(false);
  });
});
