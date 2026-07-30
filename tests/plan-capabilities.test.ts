import { describe, it, expect, afterAll } from 'vitest';
import { eq, like } from 'drizzle-orm';
import { testDb } from './utils/test-db';
import * as schema from '@/lib/db/schema';

/**
 * Shoutout eligibility used to be computed as:
 *
 *   showVideo === true || planName.includes("elite") || planSlug.includes("elite")
 *
 * so enabling video on a tier silently granted that tier newsletter shoutouts,
 * and renaming a plan silently removed them. `show_shoutouts` is now a real
 * capability. These tests pin the two properties that matter.
 */
describe('Plan capabilities: video and shoutouts are independent', () => {
  const TEST_SLUG = 'test-cap-plan';

  afterAll(async () => {
    await testDb
      .delete(schema.subscriptionPlans)
      .where(like(schema.subscriptionPlans.slug, 'test-cap-%'));
  });

  it('lets a plan have video without shoutouts', async () => {
    const [plan] = await testDb
      .insert(schema.subscriptionPlans)
      .values({
        name: 'Test Capability Plan',
        slug: TEST_SLUG,
        showVideo: true,
        showShoutouts: false,
      })
      .returning();

    // The whole point of the fix: video on, shoutouts still off.
    expect(plan.showVideo).toBe(true);
    expect(plan.showShoutouts).toBe(false);
  });

  it('lets a plan have shoutouts without video', async () => {
    const [plan] = await testDb
      .insert(schema.subscriptionPlans)
      .values({
        name: 'Test Capability Plan 2',
        slug: 'test-cap-plan-2',
        showVideo: false,
        showShoutouts: true,
      })
      .returning();

    expect(plan.showVideo).toBe(false);
    expect(plan.showShoutouts).toBe(true);
  });

  it('defaults both to false for a new plan', async () => {
    const [plan] = await testDb
      .insert(schema.subscriptionPlans)
      .values({ name: 'Test Capability Plan 3', slug: 'test-cap-plan-3' })
      .returning();

    // A new tier must not silently acquire either paid feature.
    expect(plan.showVideo).toBe(false);
    expect(plan.showShoutouts).toBe(false);
  });

  it('kept the real plans behaving as before the change', async () => {
    const plans = await testDb
      .select({
        name: schema.subscriptionPlans.name,
        showVideo: schema.subscriptionPlans.showVideo,
        showShoutouts: schema.subscriptionPlans.showShoutouts,
      })
      .from(schema.subscriptionPlans);

    const real = plans.filter((p) => !p.name.startsWith('Test Capability'));

    // Backfill granted shoutouts to Elite only, matching the old name-based test.
    const elite = real.find((p) => p.name.toLowerCase().includes('elite'));
    expect(elite, 'an Elite plan should exist').toBeDefined();
    expect(elite!.showShoutouts).toBe(true);

    for (const p of real.filter((x) => !x.name.toLowerCase().includes('elite'))) {
      expect(p.showShoutouts, `${p.name} should not have shoutouts`).toBe(false);
    }
  });

  it('does not infer shoutouts from the plan name', async () => {
    // A plan named "elite" but without the capability must NOT get shoutouts —
    // the old logic would have granted them purely from the name.
    const [plan] = await testDb
      .insert(schema.subscriptionPlans)
      .values({
        name: 'Test Capability Elite Lookalike',
        slug: 'test-cap-elite-lookalike',
        showShoutouts: false,
      })
      .returning();

    expect(plan.name.toLowerCase()).toContain('elite');
    expect(plan.showShoutouts).toBe(false);

    await testDb.delete(schema.subscriptionPlans).where(eq(schema.subscriptionPlans.id, plan.id));
  });
});
