-- Homepage ads: make the live index match what Postgres can actually use — 2026-07-30
--
-- The previous index was (placement, approval_status, is_active, starts_at, ends_at),
-- carrying the date window in the hope it would help the scheduling filter. It
-- cannot. The live condition is:
--
--   (starts_at IS NULL OR starts_at <= now) AND (ends_at IS NULL OR ends_at >= now)
--
-- Those are OR predicates, not plain comparisons, so neither column can be used
-- for an index seek — they are applied as filters after the equality columns have
-- narrowed the set. Trailing them on the key only made the index bigger and every
-- write more expensive, for no seek benefit.
--
-- What genuinely narrows the search is the three equality columns, and of those,
-- approval_status = 'approved' AND is_active = true describe nearly every row
-- worth looking at. A partial index encodes that: it indexes only live rows, so
-- it stays small no matter how many rejected or switched-off ads accumulate.
--
-- Honest note on scale: this table will hold tens of rows, and Postgres will very
-- likely sequential-scan it whatever we build. This is not a performance fix —
-- it is so the schema stops asserting a design rationale that is not true.

DROP INDEX IF EXISTS idx_homepage_ads_live;

CREATE INDEX IF NOT EXISTS idx_homepage_ads_live
  ON homepage_ads (placement)
  WHERE approval_status = 'approved' AND is_active = true;
