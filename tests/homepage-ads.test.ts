import { describe, it, expect, afterEach } from 'vitest';
import { like } from 'drizzle-orm';
import { testDb } from './utils/test-db';
import * as schema from '@/lib/db/schema';
import { liveAdCondition, resolveAdHref } from '@/lib/ads/live-ads';
import { normalizeExternalUrl } from '@/lib/safe-url';

/**
 * The database constraints are the real guarantee here: an ad that says "link to
 * an external site" with no URL, or "link to a business" with no business, would
 * render a dead click, and an end date before the start date would silently never
 * show. Those are rejected at write time rather than discovered live.
 */
const TITLE_PREFIX = '[TEST-AD]';

async function insertAd(values: Partial<typeof schema.homepageAds.$inferInsert>) {
  const { title, ...rest } = values;
  const [row] = await testDb
    .insert(schema.homepageAds)
    .values({
      imageUrl: 'https://example.test/flyer.jpg',
      placement: 'banner',
      ...rest,
      // MUST come after the spread. It used to sit before it, so `values.title`
      // overwrote the prefixed title, the afterEach `LIKE '[TEST-AD]%'` matched
      // nothing, and every run leaked its rows into the shared test branch.
      title: `${TITLE_PREFIX} ${title ?? 'untitled'}`,
    } as typeof schema.homepageAds.$inferInsert)
    .returning();
  return row;
}

describe('homepage_ads', () => {
  afterEach(async () => {
    await testDb
      .delete(schema.homepageAds)
      .where(like(schema.homepageAds.title, `${TITLE_PREFIX}%`));
  });

  describe('constraints', () => {
    it('accepts a link-free ad, which is a real case', async () => {
      // A flyer carrying a phone number needs no click-through.
      const ad = await insertAd({ title: 'no link', linkType: 'none' });
      expect(ad.linkType).toBe('none');
      expect(ad.approvalStatus).toBe('pending');
      expect(ad.isActive).toBe(true);
    });

    it('rejects an external ad with no URL', async () => {
      await expect(insertAd({ title: 'bad external', linkType: 'external' })).rejects.toThrow();
    });

    it('rejects an external ad with an empty URL', async () => {
      await expect(
        insertAd({ title: 'empty external', linkType: 'external', linkUrl: '' })
      ).rejects.toThrow();
    });

    it('rejects a business-linked ad with no business', async () => {
      await expect(insertAd({ title: 'bad business', linkType: 'business' })).rejects.toThrow();
    });

    it('rejects an unknown placement', async () => {
      await expect(insertAd({ title: 'bad placement', placement: 'popup' })).rejects.toThrow();
    });

    it('rejects an unknown link type', async () => {
      await expect(insertAd({ title: 'bad link type', linkType: 'carrier-pigeon' })).rejects.toThrow();
    });

    it('rejects an unknown approval status', async () => {
      await expect(insertAd({ title: 'bad status', approvalStatus: 'maybe' })).rejects.toThrow();
    });

    it('rejects an end date before the start date', async () => {
      await expect(
        insertAd({
          title: 'backwards dates',
          startsAt: new Date('2026-08-01'),
          endsAt: new Date('2026-07-01'),
        })
      ).rejects.toThrow();
    });

    it('accepts a valid scheduled window', async () => {
      const ad = await insertAd({
        title: 'scheduled',
        startsAt: new Date('2026-08-01'),
        endsAt: new Date('2026-09-01'),
      });
      expect(ad.startsAt).toBeTruthy();
      expect(ad.endsAt).toBeTruthy();
    });
  });

  describe('liveAdCondition', () => {
    it('includes an approved, active, unscheduled ad', async () => {
      const ad = await insertAd({ title: 'live', approvalStatus: 'approved' });
      const rows = await testDb
        .select({ id: schema.homepageAds.id })
        .from(schema.homepageAds)
        .where(liveAdCondition('banner'));
      expect(rows.map((r) => r.id)).toContain(ad.id);
    });

    it('excludes a pending ad', async () => {
      const ad = await insertAd({ title: 'pending' });
      const rows = await testDb
        .select({ id: schema.homepageAds.id })
        .from(schema.homepageAds)
        .where(liveAdCondition('banner'));
      expect(rows.map((r) => r.id)).not.toContain(ad.id);
    });

    it('excludes an approved but deactivated ad', async () => {
      const ad = await insertAd({ title: 'switched off', approvalStatus: 'approved', isActive: false });
      const rows = await testDb
        .select({ id: schema.homepageAds.id })
        .from(schema.homepageAds)
        .where(liveAdCondition('banner'));
      expect(rows.map((r) => r.id)).not.toContain(ad.id);
    });

    it('rejects the retired two-value placement', async () => {
      // 'sidebar' was split into sidebar-left/sidebar-right; the constraint is what
      // stops a stale caller writing a row that would then render nowhere.
      await expect(insertAd({ title: 'retired', placement: 'sidebar' })).rejects.toThrow();
    });

    it('keeps the three positions independent of each other', async () => {
      // Left and right previously rendered identical content because the sidebar
      // component never read its `position` prop. Each position must now be its
      // own pool, or that duplication comes straight back.
      const left = await insertAd({
        title: 'left one',
        placement: 'sidebar-left',
        approvalStatus: 'approved',
      });
      const right = await insertAd({
        title: 'right one',
        placement: 'sidebar-right',
        approvalStatus: 'approved',
      });

      const idsAt = async (placement: 'banner' | 'sidebar-left' | 'sidebar-right') =>
        (
          await testDb
            .select({ id: schema.homepageAds.id })
            .from(schema.homepageAds)
            .where(liveAdCondition(placement))
        ).map((r) => r.id);

      const leftIds = await idsAt('sidebar-left');
      expect(leftIds).toContain(left.id);
      expect(leftIds).not.toContain(right.id);

      const rightIds = await idsAt('sidebar-right');
      expect(rightIds).toContain(right.id);
      expect(rightIds).not.toContain(left.id);

      const bannerIds = await idsAt('banner');
      expect(bannerIds).not.toContain(left.id);
      expect(bannerIds).not.toContain(right.id);
    });

    it('respects the scheduled window in both directions', async () => {
      const ad = await insertAd({
        title: 'august only',
        approvalStatus: 'approved',
        startsAt: new Date('2026-08-01T00:00:00Z'),
        endsAt: new Date('2026-08-31T00:00:00Z'),
      });

      const idsAt = async (when: Date) =>
        (
          await testDb
            .select({ id: schema.homepageAds.id })
            .from(schema.homepageAds)
            .where(liveAdCondition('banner', when))
        ).map((r) => r.id);

      // `now` is injectable precisely so this can be asserted without waiting.
      expect(await idsAt(new Date('2026-07-15T00:00:00Z'))).not.toContain(ad.id);
      expect(await idsAt(new Date('2026-08-15T00:00:00Z'))).toContain(ad.id);
      expect(await idsAt(new Date('2026-09-15T00:00:00Z'))).not.toContain(ad.id);
    });
  });

  describe('resolveAdHref', () => {
    it('returns null when the ad points nowhere', () => {
      // Callers must handle null rather than falling back to "#".
      expect(resolveAdHref({ linkType: 'none', linkUrl: null })).toBeNull();
    });

    it('opens an external link in a new tab', () => {
      expect(resolveAdHref({ linkType: 'external', linkUrl: 'https://torahmasters.org' })).toEqual({
        href: 'https://torahmasters.org/',
        external: true,
      });
    });

    it('adds the missing scheme advertisers leave off', () => {
      // "torahmasters.org" alone is a RELATIVE href — it would resolve to
      // frumtoronto.com/torahmasters.org and 404.
      expect(resolveAdHref({ linkType: 'external', linkUrl: 'torahmasters.org/semicha' })).toEqual({
        href: 'https://torahmasters.org/semicha',
        external: true,
      });
    });

    it.each([
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      '  javascript:alert(1)  ',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'httpevil:payload',
    ])('refuses the unsafe scheme %s', (linkUrl) => {
      // link_url is submitted by businesses and lands straight in an href, so this
      // is a stored-XSS vector. zod's .url() does NOT catch it: it is new URL()
      // underneath, which accepts javascript: and data: as valid URLs.
      expect(resolveAdHref({ linkType: 'external', linkUrl })).toBeNull();
    });

    it.each(['https://', 'http://?q=1', 'https://:8080/x'])(
      'refuses the unparseable URL %s',
      (linkUrl) => {
        expect(resolveAdHref({ linkType: 'external', linkUrl })).toBeNull();
      }
    );

    it('refuses whitespace masquerading as a URL', () => {
      expect(resolveAdHref({ linkType: 'external', linkUrl: '   ' })).toBeNull();
    });

    it('treats a triple slash as a host, not as hostless', () => {
      // Documents why normalizeAdUrl has no hostname check: this parses to
      // host "nowhere", and a genuinely hostless http(s) URL cannot parse at all.
      expect(normalizeExternalUrl('https:///nowhere')).toBe('https://nowhere/');
    });

    it('links to the business directory page in the same tab', () => {
      expect(
        resolveAdHref({ linkType: 'business', linkUrl: null, businessSlug: 'some-shop' })
      ).toEqual({ href: '/directory/business/some-shop', external: false });
    });

    it('returns null for a business link with no slug rather than a broken URL', () => {
      expect(resolveAdHref({ linkType: 'business', linkUrl: null, businessSlug: null })).toBeNull();
    });
  });
});
