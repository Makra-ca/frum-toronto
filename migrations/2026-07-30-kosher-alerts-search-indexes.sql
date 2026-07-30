-- Search indexes for the kosher alert archive — 2026-07-30
--
-- /kosher-alerts gained a search box and searchKosherAlerts() uses
-- similarity()/word_similarity() plus ILIKE across product name, brand, agency
-- and description. Without trigram indexes each keystroke's suggestion query
-- scans all ~1,590 rows.
--
-- Additive and non-destructive.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_kosher_alerts_product_trgm
  ON kosher_alerts USING gin (product_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_kosher_alerts_brand_trgm
  ON kosher_alerts USING gin (brand gin_trgm_ops);

-- Matched with ILIKE '%term%' on the list page; a trigram index serves that,
-- a btree cannot.
CREATE INDEX IF NOT EXISTS idx_kosher_alerts_description_trgm
  ON kosher_alerts USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_kosher_alerts_agency_trgm
  ON kosher_alerts USING gin (certifying_agency gin_trgm_ops);
