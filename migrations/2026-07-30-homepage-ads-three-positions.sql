-- Homepage ads: three independent positions — 2026-07-30
--
-- `placement` was 'banner' | 'sidebar'. That mirrored the components, where
-- HomepageSidebarAds takes a `position: "left" | "right"` prop which is declared,
-- destructured, and then never read — both columns fetch the identical
-- ?placement=sidebar&limit=3 and render byte-identical content, mirrored.
--
-- So "put this ad on the right" was not an unexposed setting; it did not exist.
-- Splitting the sidebar in two makes it a real choice and doubles sidebar
-- inventory, because the columns stop duplicating each other.
--
-- Additive and non-destructive: existing 'sidebar' rows become 'sidebar-left',
-- which is what they already rendered as (among other places).

-- Widen the constraint BEFORE rewriting the data, or the UPDATE below is
-- rejected by the constraint that is still in force.
ALTER TABLE homepage_ads DROP CONSTRAINT IF EXISTS homepage_ads_placement_check;

UPDATE homepage_ads SET placement = 'sidebar-left' WHERE placement = 'sidebar';

ALTER TABLE homepage_ads ADD CONSTRAINT homepage_ads_placement_check
  CHECK (placement IN ('banner', 'sidebar-left', 'sidebar-right'));

-- Selection is `WHERE <live conditions> ORDER BY RANDOM() LIMIT 3`, so the index
-- only has to serve the filter; there is no ordering for it to satisfy.
-- sort_order is left in the table, unused, rather than dropped: dropping a column
-- is irreversible, and a future "pin this one" becomes a small change instead of
-- another migration.
DROP INDEX IF EXISTS idx_homepage_ads_live;
CREATE INDEX IF NOT EXISTS idx_homepage_ads_live
  ON homepage_ads (placement, approval_status, is_active, starts_at, ends_at);
