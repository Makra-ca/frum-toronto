import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, blogPosts, blogComments, auditLog } from "@/lib/db/schema";

/**
 * Comment moderation had no audit trail at all — `logAudit` was called from
 * none of the four comment routes. Approve, reject, delete: no record of who
 * or when.
 *
 * That matters more now that "Blocked" actually works and deletion leaves a
 * tombstone rather than the original text. A comment can stop being readable
 * by anyone, and without this the log is the only place it is recorded.
 *
 * A person deleting their OWN comment is deliberately not logged: that is
 * ordinary use, not moderation, and logging it would fill the trail with noise
 * that hides the entries worth finding.
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
const slug = `test-comment-audit-${stamp}`;
const createdUserIds: number[] = [];
let postId: number;
let author: number;
let admin: number;

async function makeUser(suffix: string, extra: Record<string, unknown> = {}) {
  const [u] = await db
    .insert(users)
    .values({
      email: `test-caudit-${suffix}-${stamp}@frumtoronto.test`,
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

async function makeComment(content: string) {
  const [c] = await db
    .insert(blogComments)
    .values({
      postId,
      authorId: author,
      content,
      parentId: null,
      approvalStatus: "pending",
      isActive: true,
    } as never)
    .returning({ id: blogComments.id });
  return c.id;
}

async function entriesFor(commentId: number) {
  return db
    .select({
      action: auditLog.action,
      actorId: auditLog.actorId,
      entityTitle: auditLog.entityTitle,
      changes: auditLog.changes,
    })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.entityType, "blog_comment"),
        eq(auditLog.entityId, commentId)
      )
    );
}

beforeAll(async () => {
  author = await makeUser("author");
  admin = await makeUser("admin", { role: "admin" });

  const [post] = await db
    .insert(blogPosts)
    .values({
      title: `Comment audit fixture ${stamp}`,
      slug,
      content: "<p>body</p>",
      authorId: author,
      approvalStatus: "approved",
      isActive: true,
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
});

async function asAdmin<T>(fn: () => Promise<T>) {
  mocks.session.user.id = String(admin);
  mocks.session.user.role = "admin";
  mocks.session.user.email = `test-caudit-admin-${stamp}@frumtoronto.test`;
  return fn();
}

describe("approving a comment", () => {
  it("records who did it and what changed", async () => {
    const id = await makeComment("approve me");
    await asAdmin(() =>
      adminRoute.PATCH(
        new Request("http://localhost/x", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvalStatus: "approved" }),
        }) as never,
        { params: Promise.resolve({ id: String(id) }) }
      )
    );

    const [entry] = await entriesFor(id);
    expect(entry).toBeDefined();
    expect(entry.action).toBe("APPROVE");
    expect(entry.actorId).toBe(admin);
    expect(entry.changes).toMatchObject({
      approvalStatus: { before: "pending", after: "approved" },
    });
  });
});

describe("rejecting a comment", () => {
  it("is logged as REJECT, distinguishable from an approval", async () => {
    const id = await makeComment("reject me");
    await asAdmin(() =>
      adminRoute.PATCH(
        new Request("http://localhost/x", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvalStatus: "rejected" }),
        }) as never,
        { params: Promise.resolve({ id: String(id) }) }
      )
    );

    const [entry] = await entriesFor(id);
    expect(entry.action).toBe("REJECT");
  });
});

describe("deleting a comment", () => {
  it("keeps the text in the log, since it is shown nowhere afterwards", async () => {
    const id = await makeComment("evidence worth keeping");
    await asAdmin(() =>
      adminRoute.DELETE(
        new Request("http://localhost/x", { method: "DELETE" }) as never,
        { params: Promise.resolve({ id: String(id) }) }
      )
    );

    const entries = await entriesFor(id);
    const del = entries.find((e) => e.action === "DELETE")!;
    expect(del).toBeDefined();
    expect(del.actorId).toBe(admin);
    expect(del.entityTitle).toContain("evidence worth keeping");
  });
});

describe("a person deleting their own comment", () => {
  it("is NOT logged — ordinary use, not moderation", async () => {
    const id = await makeComment("mine to remove");

    mocks.session.user.id = String(author);
    mocks.session.user.role = "member";
    const res = await publicRoute.DELETE(
      new Request(`http://localhost/x?commentId=${id}`, {
        method: "DELETE",
      }) as never,
      { params: Promise.resolve({ slug }) }
    );
    expect(res.status).toBe(200);

    expect(await entriesFor(id)).toHaveLength(0);
  });
});

describe("a moderator deleting someone else's comment via the public route", () => {
  it("IS logged — the same action, reachable from a different screen", async () => {
    // The delete button in CommentThread is shown to admins on every comment,
    // so this path is moderation even though it is not an /api/admin route.
    const id = await makeComment("not mine");

    mocks.session.user.id = String(admin);
    mocks.session.user.role = "admin";
    const res = await publicRoute.DELETE(
      new Request(`http://localhost/x?commentId=${id}`, {
        method: "DELETE",
      }) as never,
      { params: Promise.resolve({ slug }) }
    );
    expect(res.status).toBe(200);

    const entries = await entriesFor(id);
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe("DELETE");
    expect(entries[0].actorId).toBe(admin);
  });
});
