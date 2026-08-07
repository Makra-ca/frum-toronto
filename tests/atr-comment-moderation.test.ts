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

const { POST } = await import("@/app/api/ask-the-rabbi/[id]/comments/route");

const ATR_KEY = COMMENT_SURFACES.askTheRabbi.key;
const BLOG_KEY = COMMENT_SURFACES.blog.key;

const stamp = Date.now();
const createdUserIds: number[] = [];
let questionId: number;
let plainId: number;
let skipperId: number;
let blockedId: number;

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

async function comment(userId: number, role = "member") {
  mocks.session.user.id = String(userId);
  mocks.session.user.role = role;
  const res = await POST(
    new Request("http://localhost/api/ask-the-rabbi/1/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `atr comment ${userId}`, parentId: null }),
    }) as never,
    { params: Promise.resolve({ id: String(questionId) }) }
  );
  return { status: res.status, body: await res.json() };
}

async function statusOf(userId: number) {
  const [row] = await db
    .select({ approvalStatus: askTheRabbiComments.approvalStatus })
    .from(askTheRabbiComments)
    .where(eq(askTheRabbiComments.authorId, userId))
    .limit(1);
  return row?.approvalStatus;
}

beforeAll(async () => {
  plainId = await makeUser("plain");
  skipperId = await makeUser("skipper", { canAutoApproveAskTheRabbi: true });
  blockedId = await makeUser("blocked", { commentPermission: "blocked" });

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

describe("the two surfaces are independent", () => {
  it("holding the BLOG does not hold Ask the Rabbi", async () => {
    // The whole reason each surface has its own key.
    await setSetting(BLOG_KEY, "approved");
    await setSetting(ATR_KEY, null);

    const { status } = await comment(plainId);
    expect(status).toBe(201);
    expect(await statusOf(plainId)).toBe("approved");
  });
});

describe("the Ask the Rabbi site setting", () => {
  it("holds a comment when set to approved", async () => {
    await db
      .delete(askTheRabbiComments)
      .where(eq(askTheRabbiComments.authorId, plainId));
    await setSetting(ATR_KEY, "approved");

    const { status } = await comment(plainId);
    expect(status).toBe(201);
    expect(await statusOf(plainId)).toBe("pending");
  });

  it("is beaten by canAutoApproveAskTheRabbi", async () => {
    await setSetting(ATR_KEY, "approved");

    const { status } = await comment(skipperId);
    expect(status).toBe(201);
    expect(await statusOf(skipperId)).toBe("approved");
  });

  it("does not resurrect a blocked account", async () => {
    await setSetting(ATR_KEY, "open");

    const { status } = await comment(blockedId);
    expect(status).toBe(403);
    const rows = await db
      .select({ id: askTheRabbiComments.id })
      .from(askTheRabbiComments)
      .where(eq(askTheRabbiComments.authorId, blockedId));
    expect(rows).toHaveLength(0);
  });
});
