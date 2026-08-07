import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  blogPosts,
  blogComments,
  siteSettings,
  auditLog,
} from "@/lib/db/schema";
import { COMMENT_SURFACES } from "@/lib/comments/moderation";

/**
 * Neither surface had an edit route, so a comment was final once posted and a
 * typo could only be fixed by deleting and reposting — which on a reply loses
 * its place in the thread.
 *
 * The load-bearing test here is "an edit is re-moderated". Without it a site
 * set to hold-for-approval is trivially defeated: post something innocuous,
 * wait for approval, then edit it into whatever you wanted to say.
 */

const mocks = vi.hoisted(() => ({
  session: {
    user: { id: "0", role: "member", email: "a@b.test", name: "Author" },
  },
}));

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn(async () => mocks.session) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notifications")>()),
  notifyAdminOfSubmission: vi.fn(async () => undefined),
}));

const route = await import("@/app/api/blog/[slug]/comments/route");

const BLOG_KEY = COMMENT_SURFACES.blog.key;
const stamp = Date.now();
const slug = `test-comment-edit-${stamp}`;
const createdUserIds: number[] = [];
let postId: number;
let author: number;
let stranger: number;
let admin: number;

async function makeUser(suffix: string, extra: Record<string, unknown> = {}) {
  const [u] = await db
    .insert(users)
    .values({
      email: `test-cedit-${suffix}-${stamp}@frumtoronto.test`,
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

async function makeComment(
  authorId: number,
  content: string,
  approvalStatus = "approved",
  parentId: number | null = null
) {
  const [c] = await db
    .insert(blogComments)
    .values({
      postId,
      authorId,
      content,
      parentId,
      approvalStatus,
      isActive: true,
    } as never)
    .returning({ id: blogComments.id });
  return c.id;
}

async function edit(actorId: number, commentId: number, content: string, role = "member") {
  mocks.session.user.id = String(actorId);
  mocks.session.user.role = role;
  const res = await route.PATCH(
    new Request(`http://localhost/x?commentId=${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }) as never,
    { params: Promise.resolve({ slug }) }
  );
  return { status: res.status, body: await res.json() };
}

async function readRow(id: number) {
  const [row] = await db
    .select({
      content: blogComments.content,
      editedAt: blogComments.editedAt,
      approvalStatus: blogComments.approvalStatus,
    })
    .from(blogComments)
    .where(eq(blogComments.id, id));
  return row;
}

async function setSite(value: string | null) {
  if (value === null) {
    await db.delete(siteSettings).where(eq(siteSettings.key, BLOG_KEY));
    return;
  }
  await db
    .insert(siteSettings)
    .values({ key: BLOG_KEY, value })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value } });
}

beforeAll(async () => {
  author = await makeUser("author");
  stranger = await makeUser("stranger");
  admin = await makeUser("admin", { role: "admin" });

  const [post] = await db
    .insert(blogPosts)
    .values({
      title: `Comment edit fixture ${stamp}`,
      slug,
      content: "<p>body</p>",
      authorId: author,
      approvalStatus: "approved",
      isActive: true,
      commentModeration: null,
    } as never)
    .returning({ id: blogPosts.id });
  postId = post.id;
});

afterAll(async () => {
  if (createdUserIds.length) {
    await db.delete(auditLog).where(inArray(auditLog.actorId, createdUserIds));
  }
  await db.delete(blogComments).where(eq(blogComments.postId, postId));
  await db.delete(blogPosts).where(eq(blogPosts.id, postId));
  if (createdUserIds.length) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
  await setSite(null);
});

describe("the author editing their own comment", () => {
  it("changes the text and stamps editedAt", async () => {
    await setSite(null);
    const id = await makeComment(author, "orignal typo");

    const { status } = await edit(author, id, "original, fixed");
    expect(status).toBe(200);

    const row = await readRow(id);
    expect(row.content).toBe("original, fixed");
    expect(row.editedAt).not.toBeNull();
  });

  it("surfaces editedAt through the public GET", async () => {
    // Disclosure is the point: a reply quoting a comment that has since
    // changed misleads everyone reading afterwards.
    const res = await route.GET(new Request("http://localhost/x") as never, {
      params: Promise.resolve({ slug }),
    });
    const thread = await res.json();
    expect(thread.some((c: { editedAt: string | null }) => c.editedAt)).toBe(true);
  });
});

describe("anyone else", () => {
  it("cannot edit someone else's comment", async () => {
    const id = await makeComment(author, "not yours");
    const { status, body } = await edit(stranger, id, "hijacked");
    expect(status).toBe(403);
    expect(body.error).toMatch(/only edit your own/i);
    expect((await readRow(id)).content).toBe("not yours");
  });

  it("cannot edit it even as an admin", async () => {
    // An admin who can rewrite someone's words can put words in their mouth
    // under their name. Moderation gets hold, reject and delete instead.
    const id = await makeComment(author, "admin hands off");
    const { status } = await edit(admin, id, "rewritten by admin", "admin");
    expect(status).toBe(403);
    expect((await readRow(id)).content).toBe("admin hands off");
  });
});

describe("a deleted comment", () => {
  it("cannot be edited, and says so distinctly", async () => {
    const id = await makeComment(author, "gone");
    await db
      .update(blogComments)
      .set({ deletedAt: new Date() })
      .where(eq(blogComments.id, id));

    const { status, body } = await edit(author, id, "back from the dead");
    expect(status).toBe(410);
    expect(body.error).toMatch(/deleted/i);
    expect((await readRow(id)).content).toBe("gone");
  });
});

describe("an edit is re-moderated", () => {
  it("sends an approved comment back to pending when the site holds", async () => {
    // THE HOLE this closes: post something innocuous, wait for approval, then
    // edit it into whatever you wanted to say.
    await setSite("approved");
    const id = await makeComment(author, "innocuous", "approved");

    const { status } = await edit(author, id, "not innocuous any more");
    expect(status).toBe(200);

    const row = await readRow(id);
    expect(row.approvalStatus).toBe("pending");
    expect(row.content).toBe("not innocuous any more");
  });

  it("stays approved when nothing holds it", async () => {
    await setSite("open");
    const id = await makeComment(author, "fine", "approved");

    await edit(author, id, "still fine");
    expect((await readRow(id)).approvalStatus).toBe("approved");
  });

  it("refuses an account that has since been blocked", async () => {
    await setSite("open");
    const id = await makeComment(author, "before the block", "approved");
    await db
      .update(users)
      .set({ commentPermission: "blocked" })
      .where(eq(users.id, author));

    const { status } = await edit(author, id, "after the block");
    expect(status).toBe(403);
    expect((await readRow(id)).content).toBe("before the block");

    await db
      .update(users)
      .set({ commentPermission: "allowed" })
      .where(eq(users.id, author));
  });
});

describe("the audit trail", () => {
  it("keeps the original text when the comment had been public", async () => {
    await setSite("open");
    const id = await makeComment(author, "what people actually read", "approved");
    await edit(author, id, "what it says now");

    const entries = await db
      .select({ action: auditLog.action, changes: auditLog.changes })
      .from(auditLog)
      .where(
        and(eq(auditLog.entityType, "blog_comment"), eq(auditLog.entityId, id))
      );

    const update = entries.find((e) => e.action === "UPDATE")!;
    expect(update).toBeDefined();
    expect(update.changes).toMatchObject({
      content: {
        before: "what people actually read",
        after: "what it says now",
      },
    });
  });

  it("does not log an edit to a comment nobody had seen", async () => {
    // A pending comment was never public, so there is no before-and-after for
    // readers — logging it would bury the entries that matter.
    await setSite("open");
    const id = await makeComment(author, "never public", "pending");
    await edit(author, id, "still never public");

    const entries = await db
      .select({ id: auditLog.id })
      .from(auditLog)
      .where(
        and(eq(auditLog.entityType, "blog_comment"), eq(auditLog.entityId, id))
      );
    expect(entries).toHaveLength(0);
  });
});
