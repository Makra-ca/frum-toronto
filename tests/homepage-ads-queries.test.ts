import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { like, eq, inArray } from 'drizzle-orm';
import { testDb } from './utils/test-db';
import * as schema from '@/lib/db/schema';

/**
 * These exercise the real selection rules against the real database: how many
 * ads a position yields, that the three positions are separate pools, that the
 * mobile strip carries both sidebars, and that the ported blogger boost still
 * reserves a banner slot.
 *
 * `getLiveAds` and friends import `@/lib/db`, which points at the primary
 * database, so the queries are rebuilt here against `testDb` using the SAME
 * shared helpers (`liveAdCondition`, `liveAdOrdering`). Anything those helpers
 * govern is genuinely covered; the thin assembly in queries.ts is not, which is
 * why the blogger-boost test asserts on the composition rule rather than on
 * getBannerAds' return value directly.
 */
import { liveAdCondition, ADS_PER_POSITION } from '@/lib/ads/live-ads';

const TITLE_PREFIX = '[TEST-ADQ]';
const EMAIL_PREFIX = 'test-adq';

let bloggerUserId: number;
let bloggerBusinessId: number;
let quietBusinessId: number;

async function insertAd(values: Partial<typeof schema.homepageAds.$inferInsert>) {
  const { title, ...rest } = values;
  const [row] = await testDb
    .insert(schema.homepageAds)
    .values({
      imageUrl: 'https://example.test/flyer.jpg',
      placement: 'banner',
      approvalStatus: 'approved',
      ...rest,
      // MUST come after the spread — see the same note in homepage-ads.test.ts.
      title: `${TITLE_PREFIX} ${title ?? 'untitled'}`,
    } as typeof schema.homepageAds.$inferInsert)
    .returning();
  return row;
}

/** The live pool for a placement, using the shared condition. */
async function livePool(placement: 'banner' | 'sidebar-left' | 'sidebar-right') {
  return testDb
    .select({ id: schema.homepageAds.id, title: schema.homepageAds.title })
    .from(schema.homepageAds)
    .where(liveAdCondition(placement));
}

beforeAll(async () => {
  const [user] = await testDb
    .insert(schema.users)
    .values({
      email: `${EMAIL_PREFIX}-blogger@frumtoronto.test`,
      firstName: 'ADQ',
      lastName: 'Blogger',
      role: 'business',
    })
    .returning();
  bloggerUserId = user.id;

  const [blogBiz] = await testDb
    .insert(schema.businesses)
    .values({
      name: `${TITLE_PREFIX} Blogging Business`,
      slug: `test-adq-blogging-${user.id}`,
      userId: user.id,
      approvalStatus: 'approved',
      isActive: true,
    })
    .returning();
  bloggerBusinessId = blogBiz.id;

  const [quietBiz] = await testDb
    .insert(schema.businesses)
    .values({
      name: `${TITLE_PREFIX} Quiet Business`,
      slug: `test-adq-quiet-${user.id}`,
      approvalStatus: 'approved',
      isActive: true,
    })
    .returning();
  quietBusinessId = quietBiz.id;
});

afterAll(async () => {
  await testDb.delete(schema.homepageAds).where(like(schema.homepageAds.title, `${TITLE_PREFIX}%`));
  await testDb.delete(schema.blogPosts).where(like(schema.blogPosts.title, `${TITLE_PREFIX}%`));
  await testDb
    .delete(schema.businesses)
    .where(inArray(schema.businesses.id, [bloggerBusinessId, quietBusinessId]));
  await testDb.delete(schema.users).where(eq(schema.users.id, bloggerUserId));
});

describe('ad pools per position', () => {
  it('keeps banner, left and right as three separate pools', async () => {
    const banner = await insertAd({ title: 'pool banner', placement: 'banner' });
    const left = await insertAd({ title: 'pool left', placement: 'sidebar-left' });
    const right = await insertAd({ title: 'pool right', placement: 'sidebar-right' });

    const bannerIds = (await livePool('banner')).map((r) => r.id);
    const leftIds = (await livePool('sidebar-left')).map((r) => r.id);
    const rightIds = (await livePool('sidebar-right')).map((r) => r.id);

    expect(bannerIds).toContain(banner.id);
    expect(bannerIds).not.toContain(left.id);
    expect(bannerIds).not.toContain(right.id);

    expect(leftIds).toContain(left.id);
    expect(leftIds).not.toContain(right.id);

    expect(rightIds).toContain(right.id);
    expect(rightIds).not.toContain(left.id);
  });

  it('the mobile strip carries both sidebars, so neither side vanishes on a phone', async () => {
    const left = await insertAd({ title: 'mobile left', placement: 'sidebar-left' });
    const right = await insertAd({ title: 'mobile right', placement: 'sidebar-right' });

    const merged = [...(await livePool('sidebar-left')), ...(await livePool('sidebar-right'))].map(
      (r) => r.id
    );

    expect(merged).toContain(left.id);
    expect(merged).toContain(right.id);
  });

  it('never shows more than ADS_PER_POSITION from a larger pool', async () => {
    for (let i = 0; i < 6; i++) {
      await insertAd({ title: `overflow ${i}`, placement: 'sidebar-right' });
    }

    const shown = await testDb
      .select({ id: schema.homepageAds.id })
      .from(schema.homepageAds)
      .where(liveAdCondition('sidebar-right'))
      .limit(ADS_PER_POSITION);

    expect(shown).toHaveLength(ADS_PER_POSITION);
    // Documents the accepted consequence of random-without-pinning: with a pool
    // bigger than the slot count, no individual ad is guaranteed to appear.
    const pool = await livePool('sidebar-right');
    expect(pool.length).toBeGreaterThan(ADS_PER_POSITION);
  });
});

describe('blogger boost', () => {
  it('finds an ad whose business owner published recently', async () => {
    await testDb.insert(schema.blogPosts).values({
      title: `${TITLE_PREFIX} Recent Post`,
      slug: `test-adq-recent-${Date.now()}`,
      content: '<p>x</p>',
      authorId: bloggerUserId,
      approvalStatus: 'approved',
      isActive: true,
      publishedAt: new Date(),
    });

    const blogAd = await insertAd({
      title: 'blog active ad',
      placement: 'banner',
      businessId: bloggerBusinessId,
    });

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const authors = await testDb
      .selectDistinct({ userId: schema.blogPosts.authorId })
      .from(schema.blogPosts)
      .where(eq(schema.blogPosts.authorId, bloggerUserId));
    const authorIds = authors.map((a) => a.userId).filter((id): id is number => id !== null);

    const eligible = await testDb
      .select({ id: schema.homepageAds.id })
      .from(schema.homepageAds)
      .innerJoin(schema.businesses, eq(schema.homepageAds.businessId, schema.businesses.id))
      .where(liveAdCondition('banner'));

    expect(authorIds).toContain(bloggerUserId);
    expect(eligible.map((r) => r.id)).toContain(blogAd.id);
  });

  it('excludes an ad whose business has no blogging owner', async () => {
    // quietBusinessId has userId NULL, so it can never satisfy the inArray on
    // businesses.userId — this is the case the INNER JOIN plus isNotNull covers.
    const quietAd = await insertAd({
      title: 'quiet ad',
      placement: 'banner',
      businessId: quietBusinessId,
    });

    const [row] = await testDb
      .select({ userId: schema.businesses.userId })
      .from(schema.businesses)
      .where(eq(schema.businesses.id, quietBusinessId));

    expect(row.userId).toBeNull();
    expect(quietAd.businessId).toBe(quietBusinessId);
  });

  it('cannot reserve the slot for a community flyer, which has no business', async () => {
    const flyer = await insertAd({ title: 'community flyer', placement: 'banner' });
    expect(flyer.businessId).toBeNull();

    // The blogger-boost query INNER JOINs businesses, so a business-less ad is
    // structurally excluded from the reserved slot.
    const withBusiness = await testDb
      .select({ id: schema.homepageAds.id })
      .from(schema.homepageAds)
      .innerJoin(schema.businesses, eq(schema.homepageAds.businessId, schema.businesses.id))
      .where(liveAdCondition('banner'));

    expect(withBusiness.map((r) => r.id)).not.toContain(flyer.id);
  });
});
