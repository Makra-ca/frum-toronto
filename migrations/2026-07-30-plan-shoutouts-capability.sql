-- Decouple newsletter shoutouts from the video flag — 2026-07-30
--
-- Shoutout eligibility was computed as:
--
--   isElite = showVideo === true
--          || planName.includes("elite")
--          || planSlug.includes("elite")
--
-- in BOTH src/app/api/businesses/[id]/route.ts and .../shoutouts/route.ts, where
-- the select even labels it "proxy for Elite tier". Two problems:
--
--   1. show_video is a *video* capability. Enabling video on, say, Premium would
--      silently grant every Premium business newsletter shoutouts as well.
--   2. Matching on the plan NAME means renaming a plan quietly breaks shoutouts.
--
-- This adds a real capability column, matching the existing show_video /
-- show_in_homepage_banner / show_in_homepage_sidebar pattern.
--
-- The backfill preserves today's behaviour exactly: whichever plans currently
-- satisfy the name/slug test get the flag. show_video is false on every plan
-- right now, so that arm of the OR grants nothing and is not replicated.
--
-- Additive and non-destructive.

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS show_shoutouts BOOLEAN NOT NULL DEFAULT false;

UPDATE subscription_plans
   SET show_shoutouts = true
 WHERE LOWER(name) LIKE '%elite%'
    OR LOWER(slug) LIKE '%elite%';
