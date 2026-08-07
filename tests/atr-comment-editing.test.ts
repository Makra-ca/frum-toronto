import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  askTheRabbi,
  askTheRabbiComments,
  siteSettings,
} from "@/lib/db/schema";
import { COMMENT_SURFACES } from "@/lib/comments/moderation";

/**
 * Editing on the Ask the Rabbi surface. The blog equivalent is covered in
 * tests/comment-editing.test.ts; these pin that this surface got the same
 * three rules rather than a second rulebook — in particular that an ATR
 * MANAGER, who is not an admin, still cannot rewrite someone else's words.
 *
 * Original file header follows.
 *
 * Ask the Rabbi had no site-wide moderation layer at all — only the per-person
 * `commentPermission`. So an admin who set the site to "hold for approval"
 * would have supervised the blog and silently left Torah Q&A wide open.
 *
 * The surfaces keep SEPARATE keys on purpose, and the first test here is the
 * one that matters most: setting the blog's key must not change Ask the Rabbi.
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

const { POST, PATCH } = await import("@/app/api/ask-the-rabbi/[id]/comments/route");

const ATR_KEY = COMMENT_SURFACES.askTheRabbi.key;
const BLOG_KEY = COMMENT_SURFACES.blog.key;

const stamp = Date.now();
const createdUserIds: number[] = [];
let questionId: number;
let plainId: number;
let blockedId: number;
let managerId: number;

async function makeUser(suffix: string, extra: Record<string, unknown> = {}) {
  const [u] = await db
    .insert(users)
    .values({
      email: `test-atrmod-${suffix}-${stamp}@frumtoronto.test`,
      firstName: "Test",
      lastName: "Commenter",
      role: "member",
      isActive: true,
      emailVerified: new Date(),
      ...extra,
    } as never)
    .returning({ id: users.id });
  createdUserIds.push(u.id);
  return u.id;
}

async function setSetting(key: string, value: string | null) {
  if (value === null) {
    await db.delete(siteSettings).where(eq(siteSettings.key, key));
    return;
  }
  await db
    .insert(siteSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value } });
}



beforeAll(async () => {
  plainId = await makeUser("plain");
  blockedId = await makeUser("blocked", { commentPermission: "blocked" });
  managerId = await makeUser("manager", { canManageAskTheRabbi: true });

  const [q] = await db
    .insert(askTheRabbi)
    .values({
      title: `Comment moderation fixture ${stamp}`,
      question: "Is this covered?",
      isPublished: true,
    } as never)
    .returning({ id: askTheRabbi.id });
  questionId = q.id;
});

afterAll(async () => {
  await db
    .delete(askTheRabbiComments)
    .where(eq(askTheRabbiComments.questionId, questionId));
  await db.delete(askTheRabbi).where(eq(askTheRabbi.id, questionId));
  if (createdUserIds.length) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
  // Site-wide rows are shared state; leave nothing behind for other files.
  await setSetting(ATR_KEY, null);
  await setSetting(BLOG_KEY, null);
});


async function comment_(userId: number, content: string, role = "member") {
  mocks.session.user.id = String(userId);
  mocks.session.user.role = role;
  const res = await POST(
    new Request("http://localhost/x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, parentId: null }),
    }) as never,
    { params: Promise.resolve({ id: String(questionId) }) }
  );
  return (await res.json()) as { id: number };
}

async function editComment(
  userId: number,
  commentId: number,
  content: string,
  role = "member"
) {
  mocks.session.user.id = String(userId);
  mocks.session.user.role = role;
  const res = await PATCH(
    new Request(`http://localhost/x?commentId=${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }) as never,
    { params: Promise.resolve({ id: String(questionId) }) }
  );
  return { status: res.status, body: await res.json() };
}

async function contentOf(id: number) {
  const [row] = await db
    .select({
      content: askTheRabbiComments.content,
      editedAt: askTheRabbiComments.editedAt,
      approvalStatus: askTheRabbiComments.approvalStatus,
    })
    .from(askTheRabbiComments)
    .where(eq(askTheRabbiComments.id, id));
  return row;
}

describe("editing an Ask the Rabbi comment", () => {
  it("lets the author correct their own", async () => {
    await setSetting(ATR_KEY, "open");
    const created = await comment_(plainId, "teh answer");

    const { status } = await editComment(plainId, created.id, "the answer");
    expect(status).toBe(200);

    const row = await contentOf(created.id);
    expect(row.content).toBe("the answer");
    expect(row.editedAt).not.toBeNull();
  });

  it("refuses an ATR manager editing someone else's — moderating is not rewriting", async () => {
    // canManageAskTheRabbi can hold, reject and delete. It deliberately does
    // NOT extend to putting words in another person's mouth under their name.
    await setSetting(ATR_KEY, "open");
    const created = await comment_(plainId, "my words");

    const { status } = await editComment(
      managerId,
      created.id,
      "the manager's words"
    );
    expect(status).toBe(403);
    expect((await contentOf(created.id)).content).toBe("my words");
  });

  it("re-moderates the edit, closing the approve-then-rewrite hole", async () => {
    await setSetting(ATR_KEY, "open");
    const created = await comment_(plainId, "innocuous");
    expect((await contentOf(created.id)).approvalStatus).toBe("approved");

    await setSetting(ATR_KEY, "approved");
    const { status } = await editComment(plainId, created.id, "not innocuous");
    expect(status).toBe(200);
    expect((await contentOf(created.id)).approvalStatus).toBe("pending");
  });

  it("refuses a blocked account", async () => {
    await setSetting(ATR_KEY, "open");
    const created = await comment_(plainId, "before");

    const { status } = await editComment(blockedId, created.id, "after");
    // Not theirs AND blocked; ownership is reported first.
    expect(status).toBe(403);
    expect((await contentOf(created.id)).content).toBe("before");
  });
});

