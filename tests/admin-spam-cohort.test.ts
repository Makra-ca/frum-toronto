import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createTestUser, cleanupTestUsers } from "./utils/test-db";

/**
 * The cohort of accounts safe to clear in bulk.
 *
 * This exists because the obvious query — "delete the unverified accounts" —
 * would have destroyed the client's own work:
 *
 *   rochel@frumtoronto.com (id 9) is UNVERIFIED and owns 1,395 blog posts.
 *
 * She signs in as admin@frumtoronto.com; id 9 is the import-created account that
 * owns her articles. 86 accounts are unverified; only some are bots.
 */

const { findSpamCandidates } = await import("@/lib/admin/spam-cohort");
const { db } = await import("@/lib/db");
const { users, blogPosts } = await import("@/lib/db/schema");

const stamp = Date.now();
let botLikeId = 0;
let contributorId = 0;
let verifiedId = 0;
const postIds: number[] = [];

beforeAll(async () => {
  // Looks exactly like a bot: unverified, brand new, owns nothing.
  botLikeId = (
    await createTestUser({ email: `test-cohort-bot-${stamp}@frumtoronto.test` })
  ).id;

  // The Rochel shape, synthesised: unverified and new, but HAS posted.
  contributorId = (
    await createTestUser({ email: `test-cohort-author-${stamp}@frumtoronto.test` })
  ).id;

  const [post] = await db
    .insert(blogPosts)
    .values({
      authorId: contributorId,
      title: `[TEST] Cohort Guard ${stamp}`,
      slug: `test-cohort-guard-${stamp}`,
      content: "<p>[TEST]</p>",
      approvalStatus: "approved",
      isActive: true,
    })
    .returning({ id: blogPosts.id });
  postIds.push(post.id);

  // Verified, so never a candidate whatever else is true.
  verifiedId = (
    await createTestUser({
      email: `test-cohort-verified-${stamp}@frumtoronto.test`,
      emailVerified: new Date(),
    })
  ).id;
});

afterAll(async () => {
  if (postIds.length) await db.delete(blogPosts).where(inArray(blogPosts.id, postIds));
  await cleanupTestUsers();
});

describe("findSpamCandidates", () => {
  it("includes an unverified, brand-new account that owns nothing", async () => {
    // The positive control. Without it, every exclusion test below would pass
    // against a function that returned an empty array.
    const ids = (await findSpamCandidates()).map((c) => c.id);
    expect(ids).toContain(botLikeId);
  });

  it("excludes an unverified account that has posted", async () => {
    // THE guard. Ownership, not verification, is the safety property.
    const ids = (await findSpamCandidates()).map((c) => c.id);
    expect(ids).not.toContain(contributorId);
  });

  it("excludes a verified account", async () => {
    const ids = (await findSpamCandidates()).map((c) => c.id);
    expect(ids).not.toContain(verifiedId);
  });

  it("never returns rochel@frumtoronto.com", async () => {
    // The direct regression against the real case. Skipped rather than failed
    // if the row is absent, so this cannot become a false alarm on a fresh
    // database — but on a copy of production it is the assertion that matters.
    const [rochel] = await db
      .select({ id: users.id, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.email, "rochel@frumtoronto.com"))
      .limit(1);

    if (!rochel) return;

    // Sanity: she IS unverified, so this is not passing for the wrong reason.
    expect(rochel.emailVerified).toBeNull();

    const ids = (await findSpamCandidates()).map((c) => c.id);
    expect(ids).not.toContain(rochel.id);
  });

  it("never returns an admin or the Archive account", async () => {
    const candidates = await findSpamCandidates();
    const ids = candidates.map((c) => c.id);

    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"));

    for (const a of admins) expect(ids).not.toContain(a.id);
    expect(ids).not.toContain(3159);
  });
});
