import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createTestUser, cleanupTestUsers } from "./utils/test-db";

/**
 * PATCH /api/user/blog/[id] rewrote another user's slug before checking whether
 * the caller owned the post.
 *
 * The slug write is deliberately BEFORE applyEdit — approving inside applyEdit
 * emails the submitter a link built from the row, and blog's public path is
 * /blog/<slug>, so writing it afterwards would send a link that 404s. But
 * applyEdit is also where ownership is checked, so the sequence was:
 *
 *   1. UPDATE blog_posts SET slug = ... WHERE id = <any id>
 *   2. applyEdit -> 403
 *
 * neon-http has no transactions, so step 1 was already committed. Public reads
 * are by slug, so any of 3,058 posts could be 404'd on demand, repeatably, by
 * any logged-in member.
 */

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: String(attackerId), role: "member" } })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const { PATCH } = await import("@/app/api/user/blog/[id]/route");
const { db } = await import("@/lib/db");
const { blogPosts } = await import("@/lib/db/schema");

const stamp = Date.now();
let attackerId = 0;
let victimId = 0;
let postId = 0;
const ORIGINAL_SLUG = `test-victim-post-${stamp}`;

beforeAll(async () => {
  victimId = (await createTestUser({ email: `test-slug-victim-${stamp}@frumtoronto.test` })).id;
  attackerId = (await createTestUser({ email: `test-slug-attacker-${stamp}@frumtoronto.test` })).id;

  const [p] = await db
    .insert(blogPosts)
    .values({
      authorId: victimId,
      title: "[TEST] Victim Post",
      slug: ORIGINAL_SLUG,
      content: "<p>[TEST]</p>",
      approvalStatus: "approved",
      isActive: true,
      publishedAt: new Date(),
    })
    .returning({ id: blogPosts.id });
  postId = p.id;
});

afterAll(async () => {
  await db.delete(blogPosts).where(inArray(blogPosts.id, [postId]));
  await cleanupTestUsers();
});

describe("editing someone else's blog post", () => {
  it("is refused, and leaves their slug untouched", async () => {
    const res = await PATCH(
      new Request(`http://localhost/api/user/blog/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Hijacked Title" }),
      }) as never,
      { params: Promise.resolve({ id: String(postId) }) } as never
    );

    expect(res.status).toBe(403);

    // Fails before the fix: the slug was already rewritten by the time the
    // 403 was returned, permanently 404ing the victim's post.
    const [after] = await db
      .select({ slug: blogPosts.slug, title: blogPosts.title })
      .from(blogPosts)
      .where(eq(blogPosts.id, postId));

    expect(after.slug).toBe(ORIGINAL_SLUG);
    expect(after.title).toBe("[TEST] Victim Post");
  });
});
