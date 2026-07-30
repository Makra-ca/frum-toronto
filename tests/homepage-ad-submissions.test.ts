import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, inArray, like } from 'drizzle-orm';
import { testDb } from './utils/test-db';
import * as schema from '@/lib/db/schema';
import { allowedPlacements, MAX_ADS_PER_BUSINESS } from '@/lib/ads/submissions';
import { liveAdCondition } from '@/lib/ads/live-ads';

/**
 * The submission rules that keep a business from putting whatever it likes on
 * the homepage: what its plan grants, and that nothing it submits is visible
 * before an admin approves it.
 */
const TITLE_PREFIX = '[TEST-SUB]';

let bannerPlanId: number;
let sidebarPlanId: number;
let bothPlanId: number;
let freePlanId: number;
let ownerId: number;
let businessId: number;

async function insertAd(values: Partial<typeof schema.homepageAds.$inferInsert>) {
  const { title, ...rest } = values;
  const [row] = await testDb
    .insert(schema.homepageAds)
    .values({
      imageUrl: 'https://example.test/art.jpg',
      placement: 'banner',
      ...rest,
      title: `${TITLE_PREFIX} ${title ?? 'untitled'}`,
    } as typeof schema.homepageAds.$inferInsert)
    .returning();
  return row;
}

beforeAll(async () => {
  const plans = await testDb
    .insert(schema.subscriptionPlans)
    .values([
      { name: 'Sub Banner', slug: 'test-sub-banner', showInHomepageBanner: true },
      { name: 'Sub Sidebar', slug: 'test-sub-sidebar', showInHomepageSidebar: true },
      {
        name: 'Sub Both',
        slug: 'test-sub-both',
        showInHomepageBanner: true,
        showInHomepageSidebar: true,
      },
      { name: 'Sub Free', slug: 'test-sub-free' },
    ])
    .returning();

  bannerPlanId = plans[0].id;
  sidebarPlanId = plans[1].id;
  bothPlanId = plans[2].id;
  freePlanId = plans[3].id;

  const [owner] = await testDb
    .insert(schema.users)
    .values({
      email: 'test-sub-owner@frumtoronto.test',
      firstName: 'Sub',
      lastName: 'Owner',
      role: 'business',
    })
    .returning();
  ownerId = owner.id;

  const [business] = await testDb
    .insert(schema.businesses)
    .values({
      name: `${TITLE_PREFIX} Business`,
      slug: `test-sub-biz-${owner.id}`,
      userId: owner.id,
      subscriptionPlanId: bothPlanId,
      approvalStatus: 'approved',
      isActive: true,
    })
    .returning();
  businessId = business.id;
});

afterAll(async () => {
  await testDb.delete(schema.homepageAds).where(like(schema.homepageAds.title, `${TITLE_PREFIX}%`));
  await testDb.delete(schema.businesses).where(eq(schema.businesses.id, businessId));
  await testDb.delete(schema.users).where(eq(schema.users.id, ownerId));
  await testDb
    .delete(schema.subscriptionPlans)
    .where(inArray(schema.subscriptionPlans.id, [bannerPlanId, sidebarPlanId, bothPlanId, freePlanId]));
});

describe('allowedPlacements — what a plan grants', () => {
  it('grants nothing on a plan with neither flag', () => {
    expect(allowedPlacements({})).toEqual([]);
    expect(
      allowedPlacements({ showInHomepageBanner: false, showInHomepageSidebar: false })
    ).toEqual([]);
  });

  it('grants only what each flag says', () => {
    expect(allowedPlacements({ showInHomepageBanner: true })).toEqual(['banner']);
    expect(allowedPlacements({ showInHomepageSidebar: true })).toEqual(['sidebar']);
    expect(
      allowedPlacements({ showInHomepageBanner: true, showInHomepageSidebar: true })
    ).toEqual(['banner', 'sidebar']);
  });

  it('treats null like false, since the columns are nullable', () => {
    expect(allowedPlacements({ showInHomepageBanner: null, showInHomepageSidebar: null })).toEqual(
      []
    );
  });

  it('reflects what the plans in the database actually grant', async () => {
    const rows = await testDb
      .select({
        id: schema.subscriptionPlans.id,
        showInHomepageBanner: schema.subscriptionPlans.showInHomepageBanner,
        showInHomepageSidebar: schema.subscriptionPlans.showInHomepageSidebar,
      })
      .from(schema.subscriptionPlans)
      .where(inArray(schema.subscriptionPlans.id, [bannerPlanId, sidebarPlanId, freePlanId]));

    const byId = Object.fromEntries(rows.map((r) => [r.id, allowedPlacements(r)]));
    expect(byId[bannerPlanId]).toEqual(['banner']);
    expect(byId[sidebarPlanId]).toEqual(['sidebar']);
    expect(byId[freePlanId]).toEqual([]);
  });
});

describe('a submitted ad is invisible until approved', () => {
  it('is excluded from the live pool while pending', async () => {
    const ad = await insertAd({
      title: 'pending submission',
      businessId,
      submittedBy: ownerId,
      approvalStatus: 'pending',
    });

    const live = await testDb
      .select({ id: schema.homepageAds.id })
      .from(schema.homepageAds)
      .where(liveAdCondition('banner'));

    expect(live.map((r) => r.id)).not.toContain(ad.id);
  });

  it('appears once approved, and disappears again if rejected', async () => {
    const ad = await insertAd({
      title: 'approval round trip',
      businessId,
      submittedBy: ownerId,
      approvalStatus: 'pending',
    });

    const liveIds = async () =>
      (
        await testDb
          .select({ id: schema.homepageAds.id })
          .from(schema.homepageAds)
          .where(liveAdCondition('banner'))
      ).map((r) => r.id);

    await testDb
      .update(schema.homepageAds)
      .set({ approvalStatus: 'approved' })
      .where(eq(schema.homepageAds.id, ad.id));
    expect(await liveIds()).toContain(ad.id);

    await testDb
      .update(schema.homepageAds)
      .set({ approvalStatus: 'rejected', rejectionReason: 'Too blurry' })
      .where(eq(schema.homepageAds.id, ad.id));
    expect(await liveIds()).not.toContain(ad.id);
  });
});

describe('the ad survives its business being deleted', () => {
  it('keeps the ad and nulls the link rather than cascading', async () => {
    // business_id is ON DELETE SET NULL on purpose: removing a business must not
    // silently delete advertising that was paid for.
    const [tempBusiness] = await testDb
      .insert(schema.businesses)
      .values({
        name: `${TITLE_PREFIX} Temp`,
        slug: `test-sub-temp-${Date.now()}`,
        userId: ownerId,
        approvalStatus: 'approved',
      })
      .returning();

    const ad = await insertAd({
      title: 'orphaned',
      businessId: tempBusiness.id,
      approvalStatus: 'approved',
    });

    await testDb.delete(schema.businesses).where(eq(schema.businesses.id, tempBusiness.id));

    const [after] = await testDb
      .select({ id: schema.homepageAds.id, businessId: schema.homepageAds.businessId })
      .from(schema.homepageAds)
      .where(eq(schema.homepageAds.id, ad.id));

    expect(after).toBeDefined();
    expect(after.businessId).toBeNull();
  });
});

describe('MAX_ADS_PER_BUSINESS', () => {
  it('is a small positive number, since every ad is reviewed by hand', () => {
    expect(MAX_ADS_PER_BUSINESS).toBeGreaterThan(0);
    expect(MAX_ADS_PER_BUSINESS).toBeLessThanOrEqual(10);
  });
});
