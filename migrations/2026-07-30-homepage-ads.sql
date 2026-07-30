-- Homepage ads as first-class records — 2026-07-30
--
-- Until now an "ad" was a column: businesses.banner_image_url, shown if the
-- business's plan had show_in_homepage_banner/_sidebar, picked with
-- ORDER BY random(). That shape is a *perk* ("Premium gets homepage exposure"),
-- not *advertising*, and it cannot express:
--
--   * an advertiser who is not a business (a shul, school, semicha programme)
--   * where a given flyer should link — the old code inferred it, using the
--     business's website if present and otherwise its directory page, so nobody
--     could choose, and having a website silently overrode linking to the
--     FrumToronto page
--   * more than one ad per advertiser
--   * a listing of what is currently running
--   * running an ad for a fixed period
--   * deliberate ordering
--
-- The existing plan-based banners keep working; this runs alongside them.
--
-- Additive and non-destructive.

CREATE TABLE IF NOT EXISTS homepage_ads (
  id                SERIAL PRIMARY KEY,

  -- Admin-facing label. Not shown to visitors; it is how the ad is identified in
  -- the admin list, since an image alone is hard to scan.
  title             VARCHAR(200) NOT NULL,
  image_url         VARCHAR(500) NOT NULL,

  -- 'banner' (wide strip under the hero) or 'sidebar' (column card).
  placement         VARCHAR(20)  NOT NULL,

  -- 'business' -> the linked business's directory page
  -- 'external'  -> link_url, opened in a new tab
  -- 'none'      -> the flyer overlay only, no click-through
  link_type         VARCHAR(20)  NOT NULL DEFAULT 'none',
  link_url          VARCHAR(500),

  -- Set when the ad belongs to a business, whether or not it links there. Also
  -- identifies who submitted it. ON DELETE SET NULL so removing a business does
  -- not silently delete a paid ad.
  business_id       INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
  submitted_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,

  -- Businesses submit; an admin approves. Admin-created ads are approved on
  -- insert by the API, not by this default.
  approval_status   VARCHAR(20)  NOT NULL DEFAULT 'pending',
  rejection_reason  TEXT,

  -- Scheduling. NULL means "no bound", so an ad with neither runs indefinitely.
  starts_at         TIMESTAMP,
  ends_at           TIMESTAMP,

  is_active         BOOLEAN      NOT NULL DEFAULT true,
  sort_order        INTEGER      NOT NULL DEFAULT 0,

  -- Cheap click counting. Impressions are deliberately not tracked: it would
  -- mean a write on every homepage render.
  click_count       INTEGER      NOT NULL DEFAULT 0,

  created_at        TIMESTAMP    DEFAULT NOW(),
  updated_at        TIMESTAMP    DEFAULT NOW()
);

-- Guard the enum-ish columns at the database level so a bad write cannot make an
-- ad unrenderable.
ALTER TABLE homepage_ads DROP CONSTRAINT IF EXISTS homepage_ads_placement_check;
ALTER TABLE homepage_ads ADD CONSTRAINT homepage_ads_placement_check
  CHECK (placement IN ('banner', 'sidebar'));

ALTER TABLE homepage_ads DROP CONSTRAINT IF EXISTS homepage_ads_link_type_check;
ALTER TABLE homepage_ads ADD CONSTRAINT homepage_ads_link_type_check
  CHECK (link_type IN ('business', 'external', 'none'));

ALTER TABLE homepage_ads DROP CONSTRAINT IF EXISTS homepage_ads_approval_check;
ALTER TABLE homepage_ads ADD CONSTRAINT homepage_ads_approval_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- An 'external' ad without a URL, or a 'business' ad without a business, would
-- render a dead click. Reject it at write time rather than discovering it live.
ALTER TABLE homepage_ads DROP CONSTRAINT IF EXISTS homepage_ads_link_target_check;
ALTER TABLE homepage_ads ADD CONSTRAINT homepage_ads_link_target_check
  CHECK (
    (link_type = 'external' AND link_url IS NOT NULL AND link_url <> '')
    OR (link_type = 'business' AND business_id IS NOT NULL)
    OR link_type = 'none'
  );

-- An end date before the start date would silently never show.
ALTER TABLE homepage_ads DROP CONSTRAINT IF EXISTS homepage_ads_date_order_check;
ALTER TABLE homepage_ads ADD CONSTRAINT homepage_ads_date_order_check
  CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at);

-- The public query filters on placement + approval + active + the date window,
-- then orders by sort_order.
CREATE INDEX IF NOT EXISTS idx_homepage_ads_live
  ON homepage_ads (placement, approval_status, is_active, sort_order);

-- The admin review queue.
CREATE INDEX IF NOT EXISTS idx_homepage_ads_approval
  ON homepage_ads (approval_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_homepage_ads_business
  ON homepage_ads (business_id);
