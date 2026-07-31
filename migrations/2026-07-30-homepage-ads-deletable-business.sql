-- Homepage ads: stop a business-linked ad making its business undeletable — 2026-07-30
--
-- `business_id` is ON DELETE SET NULL so that removing a business does not
-- silently delete advertising that was paid for. That intent was defeated by
-- homepage_ads_link_target_check:
--
--   (link_type = 'business' AND business_id IS NOT NULL)
--
-- The cascade performs an UPDATE, and Postgres re-validates CHECK constraints on
-- an UPDATE. So the SET NULL was rejected, the DELETE failed, and the business
-- became undeletable — DELETE /api/admin/businesses/[id] returned a 500 for any
-- business that had a business-linked ad. Two individually reasonable guarantees
-- that cannot both hold.
--
-- Reproduced before this fix:
--   new row for relation "homepage_ads" violates check constraint
--   "homepage_ads_link_target_check"
--
-- Resolution: the DATABASE now permits link_type='business' with a NULL
-- business_id, which is exactly the state the cascade needs to produce. That row
-- is not a dead click — `resolveAdHref` already returns null for a business link
-- without a slug, so the ad renders as an unclickable flyer rather than a broken
-- link, and the admin list shows it needs attention.
--
-- Requiring a business at WRITE time stays where it belongs, in
-- src/lib/validations/ads.ts, which rejects link_type='business' with no
-- businessId. The constraint's job is integrity; refusing to let an orphaned row
-- exist was never integrity, it was policy, and it cost data-safety to enforce.

ALTER TABLE homepage_ads DROP CONSTRAINT IF EXISTS homepage_ads_link_target_check;
ALTER TABLE homepage_ads ADD CONSTRAINT homepage_ads_link_target_check
  CHECK (
    (link_type = 'external' AND link_url IS NOT NULL AND btrim(link_url) <> '')
    OR link_type = 'business'
    OR link_type = 'none'
  );

-- Holes found by probing the table directly: all of these were accepted and all
-- produce an ad that renders as an empty box or a nonsense counter.
ALTER TABLE homepage_ads DROP CONSTRAINT IF EXISTS homepage_ads_image_present_check;
ALTER TABLE homepage_ads ADD CONSTRAINT homepage_ads_image_present_check
  CHECK (btrim(image_url) <> '');

ALTER TABLE homepage_ads DROP CONSTRAINT IF EXISTS homepage_ads_title_present_check;
ALTER TABLE homepage_ads ADD CONSTRAINT homepage_ads_title_present_check
  CHECK (btrim(title) <> '');

ALTER TABLE homepage_ads DROP CONSTRAINT IF EXISTS homepage_ads_click_count_check;
ALTER TABLE homepage_ads ADD CONSTRAINT homepage_ads_click_count_check
  CHECK (click_count >= 0);
