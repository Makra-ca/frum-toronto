import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, blogPosts } from "@/lib/db/schema";

/**
 * Blog adopting the same rule as every other type.
 *
 * Its old rule was the exact opposite — "only pending or rejected posts can be
 * edited" — so an author could never fix a typo in a published post. Sequenced
 * last on purpose: 3,058 owned posts run through this route, more than every
 * other type combined.
 *
 * The two silent defects being fixed are about publishedAt. The old code set
 * `publishedAt = canAutoApprove ? new Date() : null`, so an ordinary edit
 * NULLED it and an auto-approver's edit moved it to now. /api/blog orders by
 * publishedAt DESC and Postgres sorts NULLs FIRST in DESC — so a corrected
 * post jumped to the top of the blog either way.
 */

const mocks = vi.hoisted(() => ({
  session: { user: { id: "0", role: "member", email: "a@b.test", name: "Author" } },
}));

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn(async () => mocks.session) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notifications")>()),
  notifyAdminOfSubmission: vi.fn(async () => undefined),
  notifyAdminOfTrustedEdit: vi.fn(async () => undefined),
}));

const { PATCH } = await import("@/app/api/user/blog/[id]/route");

const stamp = Date.now();
const createdUserIds: number[] = [];
const createdPostIds: number[] = [];
let authorId: number;
let trustedId: number;
let strangerId: number;

async function makeUser(email: string, extra: Record<string, unknown> = {}) {
  const [u] = await db
    .insert(users)
    .values({
      email,
      firstName: "Test",
      lastName: "Author",
      role: "member",
      isActive: true,
      emailVerified: new Date(),
      ...extra,
    } as never)
    .returning({ id: users.id });
  createdUserIds.push(u.id);
  return u.id;
}

async function makePost(
  ownerId: number,
  approvalStatus: string,
  publishedAt: Date | null = null
) {
  const [p] = await db
    .insert(blogPosts)
    .values({
      authorId: ownerId,
      title: `[TEST] user blog ${createdPostIds.length}`,
      slug: `test-user-blog-${stamp}-${createdPostIds.length}`,
      content: "<p>[TEST]</p>",
      approvalStatus,
      publishedAt,
      isActive: true,
    })
    .returning({ id: blogPosts.id });
  createdPostIds.push(p.id);
  return p.id;
}

async function patch(id: number, body: Record<string, unknown>) {
  return PATCH(
    new Request(`http://localhost/api/user/blog/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ id: String(id) }) }
  ) as Promise<Response>;
}

function signIn(id: number) {
  mocks.session = {
    user: { id: String(id), role: "member", email: "a@b.test", name: "Author" },
  };
}

async function read(id: number) {
  const [row] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
  return row;
}

beforeAll(async () => {
  authorId = await makeUser(`test-userblog-author-${stamp}@frumtoronto.test`);
  trustedId = await makeUser(`test-userblog-trusted-${stamp}@frumtoronto.test`, {
    canAutoApproveBlog: true,
  });
  strangerId = await makeUser(`test-userblog-stranger-${stamp}@frumtoronto.test`);
});

afterAll(async () => {
  if (createdPostIds.length) {
    await db.delete(blogPosts).where(inArray(blogPosts.id, createdPostIds));
  }
  if (createdUserIds.length) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

describe("PATCH /api/user/blog/[id]", () => {
  it("lets an author edit a PUBLISHED post at all", async () => {
    // The headline change. This used to be a 400.
    signIn(authorId);
    const id = await makePost(authorId, "approved", new Date("2024-01-01T00:00:00.000Z"));

    const res = await patch(id, { title: "[TEST] fixed a typo", content: "<p>fixed</p>" });

    expect(res.status).toBe(200);
    expect((await read(id)).title).toBe("[TEST] fixed a typo");
  });

  it("unpublishes that post as pending_edit, not pending", async () => {
    signIn(authorId);
    const id = await makePost(authorId, "approved", new Date("2024-01-01T00:00:00.000Z"));

    const res = await patch(id, { title: "[TEST] corrected", content: "<p>x</p>" });
    const body = await res.json();

    expect(body.status).toBe("pending_edit");
    expect((await read(id)).approvalStatus).toBe("pending_edit");
    expect(body.message).toContain("taken off the site");
  });

  it("does not touch publishedAt on an ordinary edit", async () => {
    // The old route nulled it, and NULLs sort FIRST under DESC — so the
    // corrected post led the blog.
    signIn(authorId);
    const published = new Date("2024-01-01T00:00:00.000Z");
    const id = await makePost(authorId, "approved", published);

    await patch(id, { title: "[TEST] still dated", content: "<p>x</p>" });

    expect((await read(id)).publishedAt?.toISOString()).toBe(published.toISOString());
  });

  it("does not move publishedAt when an auto-approver edits", async () => {
    // The old route set it to now, sending a years-old post back to the top.
    signIn(trustedId);
    const published = new Date("2024-01-01T00:00:00.000Z");
    const id = await makePost(trustedId, "approved", published);

    const res = await patch(id, { title: "[TEST] trusted fix", content: "<p>x</p>" });
    const body = await res.json();

    expect(body.status).toBe("approved");
    const row = await read(id);
    expect(row.approvalStatus).toBe("approved");
    expect(row.publishedAt?.toISOString()).toBe(published.toISOString());
  });

  it("stamps publishedAt the first time a post goes live", async () => {
    signIn(trustedId);
    const id = await makePost(trustedId, "pending", null);

    await patch(id, { title: "[TEST] first publish", content: "<p>x</p>" });

    const row = await read(id);
    expect(row.approvalStatus).toBe("approved");
    expect(row.publishedAt).not.toBeNull();
  });

  it("regenerates the slug when the title changes", async () => {
    signIn(authorId);
    const id = await makePost(authorId, "pending");
    const before = (await read(id)).slug;

    await patch(id, { title: "[TEST] a completely different title", content: "<p>x</p>" });

    expect((await read(id)).slug).not.toBe(before);
  });

  it("leaves the slug alone when the title does not change", async () => {
    signIn(authorId);
    const id = await makePost(authorId, "pending");
    const before = await read(id);

    await patch(id, { title: before.title, content: "<p>changed body only</p>" });

    expect((await read(id)).slug).toBe(before.slug);
  });

  it("refuses a stranger", async () => {
    signIn(strangerId);
    const id = await makePost(authorId, "pending");

    const res = await patch(id, { title: "[TEST] hijack", content: "<p>x</p>" });

    expect(res.status).toBe(403);
    expect((await read(id)).title).not.toBe("[TEST] hijack");
  });

  it("ignores an attempt to self-approve", async () => {
    signIn(authorId);
    const id = await makePost(authorId, "pending");

    await patch(id, {
      title: "[TEST] sneaky",
      content: "<p>x</p>",
      approvalStatus: "approved",
      authorId: strangerId,
    });

    const row = await read(id);
    expect(row.approvalStatus).toBe("pending");
    expect(row.authorId).toBe(authorId);
  });

  it("still refuses a post that does not exist", async () => {
    signIn(authorId);

    const res = await patch(999999999, { title: "[TEST] ghost", content: "<p>x</p>" });

    expect(res.status).toBe(404);
  });
});
