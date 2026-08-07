import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, blogPosts, blogComments, siteSettings } from "@/lib/db/schema";
import { BLOG_COMMENT_MODERATION_KEY } from "@/lib/comments/moderation";

/**
 * `users.commentPermission` is set per account in Admin → Users and offers
 * Allowed / Requires Approval / Blocked. Ask the Rabbi enforced all three; the
 * blog comment route never read the column at all, so a Blocked account could
 * comment freely on any post and a supervised account published instantly.
 *
 * These exercise the real route end to end — the pure decision function is
 * covered separately in tests/unit/blog-comment-moderation.test.ts. Both are
 * needed: the unit tests pin the rules, these pin that the route actually
 * calls them and writes the result.
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

const { POST } = await import("@/app/api/blog/[slug]/comments/route");

const stamp = Date.now();
const slug = `test-comment-permission-${stamp}`;
const createdUserIds: number[] = [];
let postId: number;
let allowedId: number;
let supervisedId: number;
let blockedId: number;
let adminId: number;

/** Whatever the setting was before this file ran, so it can be put back. */
let originalSetting: string | null | undefined;
let settingExisted = false;

async function makeUser(suffix: string, extra: Record<string, unknown> = {}) {
  const [u] = await db
    .insert(users)
    .values({
      email: `test-${suffix}-${stamp}@frumtoronto.test`,
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

async function comment(userId: number, role = "member") {
  mocks.session.user.id = String(userId);
  mocks.session.user.role = role;
  const res = await POST(
    new Request("http://localhost/api/blog/x/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `hello from ${userId}`, parentId: null }),
    }) as never,
    { params: Promise.resolve({ slug }) }
  );
  return { status: res.status, body: await res.json() };
}

beforeAll(async () => {
  allowedId = await makeUser("allowed", { commentPermission: "allowed" });
  supervisedId = await makeUser("supervised", {
    commentPermission: "requires_approval",
  });
  blockedId = await makeUser("blocked", { commentPermission: "blocked" });
  adminId = await makeUser("admin-blocked", {
    role: "admin",
    commentPermission: "blocked",
  });

  const [post] = await db
    .insert(blogPosts)
    .values({
      title: `Comment permission fixture ${stamp}`,
      slug,
      content: "<p>body</p>",
      authorId: allowedId,
      approvalStatus: "approved",
      isActive: true,
      // null so the site-wide setting is the one under test
      commentModeration: null,
    } as never)
    .returning({ id: blogPosts.id });
  postId = post.id;

  const [existing] = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, BLOG_COMMENT_MODERATION_KEY))
    .limit(1);
  settingExisted = existing !== undefined;
  originalSetting = existing?.value;
});

afterAll(async () => {
  await db.delete(blogComments).where(eq(blogComments.postId, postId));
  await db.delete(blogPosts).where(eq(blogPosts.id, postId));
  if (createdUserIds.length) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
  // Restore the shared row rather than leaving this file's value behind — it
  // is site-wide state, so another file reading it would see our writes.
  if (settingExisted) {
    await db
      .update(siteSettings)
      .set({ value: originalSetting ?? null })
      .where(eq(siteSettings.key, BLOG_COMMENT_MODERATION_KEY));
  } else {
    await db
      .delete(siteSettings)
      .where(eq(siteSettings.key, BLOG_COMMENT_MODERATION_KEY));
  }
});

async function statusOfLatestComment(userId: number) {
  const [row] = await db
    .select({ approvalStatus: blogComments.approvalStatus })
    .from(blogComments)
    .where(eq(blogComments.authorId, userId))
    .limit(1);
  return row?.approvalStatus;
}

describe("a Blocked account", () => {
  it("is refused with 403", async () => {
    const { status, body } = await comment(blockedId);
    expect(status).toBe(403);
    expect(body.error).toMatch(/not permitted/i);
  });

  it("writes no row at all — nothing lands in the moderation queue", async () => {
    // A block that produced a pending row would put the text in front of an
    // admin who might approve it without noticing who wrote it.
    const rows = await db
      .select({ id: blogComments.id })
      .from(blogComments)
      .where(eq(blogComments.authorId, blockedId));
    expect(rows).toHaveLength(0);
  });
});

describe("a Requires Approval account", () => {
  it("is accepted but held as pending", async () => {
    const { status } = await comment(supervisedId);
    expect(status).toBe(201);
    expect(await statusOfLatestComment(supervisedId)).toBe("pending");
  });
});

describe("an Allowed account", () => {
  it("publishes immediately under the default setting", async () => {
    await db
      .delete(siteSettings)
      .where(eq(siteSettings.key, BLOG_COMMENT_MODERATION_KEY));

    const { status } = await comment(allowedId);
    expect(status).toBe(201);
    expect(await statusOfLatestComment(allowedId)).toBe("approved");
  });
});

describe("the site-wide setting", () => {
  it("holds an otherwise-allowed account when set to approved", async () => {
    await db.delete(blogComments).where(eq(blogComments.authorId, allowedId));
    await db
      .insert(siteSettings)
      .values({ key: BLOG_COMMENT_MODERATION_KEY, value: "approved" })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value: "approved" },
      });

    const { status } = await comment(allowedId);
    expect(status).toBe(201);
    expect(await statusOfLatestComment(allowedId)).toBe("pending");
  });
});

describe("an admin", () => {
  it("publishes even when the account is Blocked and the site holds", async () => {
    // Matches Ask the Rabbi, where a manager bypasses both controls.
    const { status } = await comment(adminId, "admin");
    expect(status).toBe(201);
    expect(await statusOfLatestComment(adminId)).toBe("approved");
  });
});
