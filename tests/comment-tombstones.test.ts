import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, blogPosts, blogComments } from "@/lib/db/schema";
import { TOMBSTONE_CONTENT } from "@/lib/comments/tombstone";

/**
 * Deleting a comment used to mean three different things depending on the
 * button:
 *
 *   user deletes own top-level  -> app-level cascade, replies DESTROYED
 *   admin deletes via the queue -> bare DELETE, replies ORPHANED (matched no
 *                                  parent, were not top-level, so they
 *                                  rendered nowhere and stayed forever)
 *   admin deletes an ATR comment-> soft delete only
 *
 * These exercise both blog routes against a real thread. The unit tests pin
 * the rule; these pin that the routes apply it and that a tombstone does not
 * leak what it replaced.
 */

const mocks = vi.hoisted(() => ({
  session: {
    user: { id: "0", role: "member", email: "a@b.test", name: "Commenter" },
  },
}));

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn(async () => mocks.session) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notifications")>()),
  notifyAdminOfSubmission: vi.fn(async () => undefined),
}));

const publicRoute = await import("@/app/api/blog/[slug]/comments/route");
const adminRoute = await import("@/app/api/admin/blog/comments/[id]/route");

const stamp = Date.now();
const slug = `test-tombstone-${stamp}`;
const createdUserIds: number[] = [];
let postId: number;
let asker: number;
let answerer: number;
let admin: number;

async function makeUser(suffix: string, extra: Record<string, unknown> = {}) {
  const [u] = await db
    .insert(users)
    .values({
      email: `test-tomb-${suffix}-${stamp}@frumtoronto.test`,
      firstName: "Test",
      lastName: suffix,
      role: "member",
      isActive: true,
      emailVerified: new Date(),
      ...extra,
    } as never)
    .returning({ id: users.id });
  createdUserIds.push(u.id);
  return u.id;
}

async function makeComment(authorId: number, parentId: number | null) {
  const [c] = await db
    .insert(blogComments)
    .values({
      postId,
      authorId,
      content: `secret text ${authorId}-${parentId ?? "top"}`,
      parentId,
      approvalStatus: "approved",
      isActive: true,
    } as never)
    .returning({ id: blogComments.id });
  return c.id;
}

type Rendered = {
  id: number;
  content: string;
  parentId: number | null;
  isDeleted: boolean;
  authorName: string | null;
  authorId: number | null;
};

async function readThread(): Promise<Rendered[]> {
  const res = await publicRoute.GET(
    new Request("http://localhost/x") as never,
    { params: Promise.resolve({ slug }) }
  );
  expect(res.status).toBe(200);
  return res.json();
}

async function userDelete(actorId: number, commentId: number) {
  mocks.session.user.id = String(actorId);
  mocks.session.user.role = "member";
  return publicRoute.DELETE(
    new Request(`http://localhost/x?commentId=${commentId}`, {
      method: "DELETE",
    }) as never,
    { params: Promise.resolve({ slug }) }
  );
}

async function adminDelete(commentId: number) {
  mocks.session.user.id = String(admin);
  mocks.session.user.role = "admin";
  return adminRoute.DELETE(
    new Request("http://localhost/x", { method: "DELETE" }) as never,
    { params: Promise.resolve({ id: String(commentId) }) }
  );
}

beforeAll(async () => {
  asker = await makeUser("asker");
  answerer = await makeUser("answerer");
  admin = await makeUser("admin", { role: "admin" });

  const [post] = await db
    .insert(blogPosts)
    .values({
      title: `Tombstone fixture ${stamp}`,
      slug,
      content: "<p>body</p>",
      authorId: asker,
      approvalStatus: "approved",
      isActive: true,
    } as never)
    .returning({ id: blogPosts.id });
  postId = post.id;
});

afterAll(async () => {
  await db.delete(blogComments).where(eq(blogComments.postId, postId));
  await db.delete(blogPosts).where(eq(blogPosts.id, postId));
  if (createdUserIds.length) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

describe("a user deleting their own comment with a reply on it", () => {
  let parent: number;
  let reply: number;

  beforeAll(async () => {
    parent = await makeComment(asker, null);
    reply = await makeComment(answerer, parent);
  });

  it("does not destroy the reply", async () => {
    // The old route cascade-deleted every reply, so removing your own question
    // deleted someone else's answer with it.
    const res = await userDelete(asker, parent);
    expect(res.status).toBe(200);

    const rows = await db
      .select({ id: blogComments.id })
      .from(blogComments)
      .where(eq(blogComments.id, reply));
    expect(rows).toHaveLength(1);
  });

  it("keeps the parent visible as a tombstone so the reply keeps its place", async () => {
    const thread = await readThread();
    const ids = thread.map((c) => c.id);
    expect(ids).toContain(parent);
    expect(ids).toContain(reply);
  });

  it("leaks neither the original text nor the author", async () => {
    const thread = await readThread();
    const tomb = thread.find((c) => c.id === parent)!;
    expect(tomb.isDeleted).toBe(true);
    expect(tomb.content).toBe(TOMBSTONE_CONTENT);
    expect(tomb.content).not.toContain("secret text");
    expect(tomb.authorName).toBeNull();
    expect(tomb.authorId).toBeNull();
    // And nothing anywhere in the payload still carries it.
    expect(JSON.stringify(thread)).not.toContain(`secret text ${asker}-top`);
  });

  it("leaves the reply itself untouched", async () => {
    const thread = await readThread();
    const kept = thread.find((c) => c.id === reply)!;
    expect(kept.isDeleted).toBe(false);
    expect(kept.content).toContain("secret text");
    expect(kept.authorName).toBeTruthy();
  });
});

describe("a user deleting a comment nobody replied to", () => {
  it("disappears from the thread entirely", async () => {
    const lonely = await makeComment(answerer, null);
    expect((await readThread()).map((c) => c.id)).toContain(lonely);

    const res = await userDelete(answerer, lonely);
    expect(res.status).toBe(200);

    expect((await readThread()).map((c) => c.id)).not.toContain(lonely);
  });
});

describe("an admin deleting from the moderation queue", () => {
  let parent: number;
  let reply: number;

  beforeAll(async () => {
    parent = await makeComment(answerer, null);
    reply = await makeComment(asker, parent);
  });

  it("no longer orphans the reply", async () => {
    // The admin route was a bare DELETE with no reply handling, so the reply
    // survived in the table but matched no parent and rendered nowhere.
    const res = await adminDelete(parent);
    expect(res.status).toBe(200);

    const thread = await readThread();
    const ids = thread.map((c) => c.id);
    expect(ids).toContain(parent);
    expect(ids).toContain(reply);
    expect(thread.find((c) => c.id === parent)!.isDeleted).toBe(true);
  });

  it("keeps the row rather than destroying it", async () => {
    const rows = await db
      .select({ id: blogComments.id, deletedAt: blogComments.deletedAt })
      .from(blogComments)
      .where(eq(blogComments.id, parent));
    expect(rows).toHaveLength(1);
    expect(rows[0].deletedAt).not.toBeNull();
  });

  it("drops it out of the moderation queue", async () => {
    // Nothing left to moderate, and its text is shown to nobody.
    const listed = await db
      .select({ id: blogComments.id })
      .from(blogComments)
      .where(isNull(blogComments.deletedAt));
    expect(listed.map((r) => r.id)).not.toContain(parent);
  });
});

describe("the parent_id foreign key", () => {
  it("cascades, so a hard delete cannot orphan a reply", async () => {
    // blog_comments.parent_id was a bare integer with no constraint at all.
    // The user-purge path still hard-deletes, so the database must guarantee
    // this even when the application does not.
    const parent = await makeComment(asker, null);
    const reply = await makeComment(answerer, parent);

    await db.delete(blogComments).where(eq(blogComments.id, parent));

    const rows = await db
      .select({ id: blogComments.id })
      .from(blogComments)
      .where(eq(blogComments.id, reply));
    expect(rows).toHaveLength(0);
  });

  it("rejects a reply pointing at a comment that does not exist", async () => {
    await expect(
      db.insert(blogComments).values({
        postId,
        authorId: asker,
        content: "orphan",
        parentId: 2_000_000_000,
        approvalStatus: "approved",
      } as never)
    ).rejects.toThrow();
  });
});
