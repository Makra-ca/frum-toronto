import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createTestUser, cleanupTestUsers } from "./utils/test-db";

/**
 * The Low list from docs/project-memory/SECURITY-FINDINGS-2026-08-04.md.
 * Individually small; each one hands out something it should not.
 */

const state = vi.hoisted(() => ({ loggedIn: true }));

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () =>
    state.loggedIn ? { user: { id: String(authorId), role: "member" } } : null
  ),
}));
vi.mock("@/lib/notifications", () => ({
  notifyAdminOfSubmission: vi.fn(async () => undefined),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const { GET: getConflicts } = await import("@/app/api/events/conflicts/route");
const { GET: getBlog } = await import("@/app/api/blog/route");
const { POST: createBlogPost } = await import("@/app/api/user/blog/route");
const { db } = await import("@/lib/db");
const { events, blogPosts } = await import("@/lib/db/schema");

const stamp = Date.now();
let authorId = 0;
let eventId = 0;
const createdPostIds: number[] = [];

beforeAll(async () => {
  authorId = (
    await createTestUser({
      email: `test-low-author-${stamp}@frumtoronto.test`,
      emailVerified: new Date(),
    })
  ).id;

  const [e] = await db
    .insert(events)
    .values({
      title: `[TEST] Conflict Probe ${stamp}`,
      startTime: new Date("2031-03-04T18:00:00Z"),
      approvalStatus: "approved",
      isActive: true,
      contactName: "Organiser Name",
      organization: "Test Organisation",
      contactEmail: "organiser-should-not-leak@frumtoronto.test",
    })
    .returning({ id: events.id });
  eventId = e.id;
});

afterAll(async () => {
  await db.delete(events).where(eq(events.id, eventId));
  if (createdPostIds.length) {
    await db.delete(blogPosts).where(inArray(blogPosts.id, createdPostIds));
  }
  await cleanupTestUsers();
});

describe("/api/events/conflicts", () => {
  const call = () =>
    getConflicts(
      new Request("http://localhost/api/events/conflicts?date=2031-03-04") as never
    );

  it("no longer answers anonymous callers", async () => {
    // It was open, so iterating ?date= over a year enumerated organisers with
    // no account at all. Both real callers are behind a login.
    state.loggedIn = false;
    try {
      const res = await call();
      expect(res.status).toBe(401);
    } finally {
      state.loggedIn = true;
    }
  });

  it("does not return organiser email addresses", async () => {
    const res = await call();
    expect(res.status).toBe(200);

    const body = await res.json();
    const match = body.conflicts.find(
      (c: { id: number }) => c.id === eventId
    );

    expect(match).toBeDefined();
    // Still enough to show "clashes with X" — which is all the modal renders.
    expect(match.organization).toBe("Test Organisation");
    expect(match.contactName).toBe("Organiser Name");
    expect(match.contactEmail).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("organiser-should-not-leak");
  });
});

describe("/api/blog pagination bounds", () => {
  const call = (qs: string) =>
    getBlog(new Request(`http://localhost/api/blog?${qs}`) as never);

  it("caps an unbounded limit", async () => {
    // ?limit=100000 returned all 3,058 posts, full HTML bodies, anonymously.
    const res = await call("limit=100000");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.pagination.limit).toBe(50);
    expect(body.data.length).toBeLessThanOrEqual(50);
  });

  it("survives junk page and limit values instead of 500ing", async () => {
    // A negative or NaN page produced a negative/NaN OFFSET, which Postgres
    // rejects outright.
    for (const qs of ["page=-5", "page=abc", "limit=0", "limit=-1", "limit=xyz"]) {
      const res = await call(qs);
      expect(res.status, qs).toBe(200);
    }
  });
});

describe("blog comment moderation", () => {
  it("cannot be set by the author on their own post", async () => {
    // commentModeration is a post-level OVERRIDE that beats the site-wide
    // setting, so accepting it here let an author switch off moderation an
    // admin had turned on for the whole site. The editor already sent null for
    // non-admins — the server simply trusted whatever arrived.
    const res = await createBlogPost(
      new Request("http://localhost/api/user/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `[TEST] Moderation Override ${stamp}`,
          content: "<p>[TEST]</p>",
          commentModeration: "open",
        }),
      }) as never
    );

    expect(res.status).toBe(201);
    const created = await res.json();
    createdPostIds.push(created.id);

    const [row] = await db
      .select({ commentModeration: blogPosts.commentModeration })
      .from(blogPosts)
      .where(eq(blogPosts.id, created.id));

    // null = inherit the site-wide setting, which is the point.
    expect(row.commentModeration).toBeNull();
  });
});
