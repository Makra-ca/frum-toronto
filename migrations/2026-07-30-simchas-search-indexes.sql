-- Search indexes for the simcha archive — 2026-07-30
--
-- /simchas gained a search box, and searchSimchas() in src/lib/search/fuzzy-search.ts
-- uses similarity()/word_similarity() plus ILIKE. Without trigram indexes each
-- keystroke's suggestion query scans all ~16,550 rows.
--
-- Mirrors the indexes scripts/enable-universal-search-indexes.ts created for the
-- other searchable tables. Additive and non-destructive.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_simchas_family_name_trgm
  ON simchas USING gin (family_name gin_trgm_ops);

-- The announcement body is matched with ILIKE for substring search on the list
-- page (so a grandparent named only in the text is findable). A trigram index
-- serves ILIKE '%term%' too, which a btree cannot.
CREATE INDEX IF NOT EXISTS idx_simchas_announcement_trgm
  ON simchas USING gin (announcement gin_trgm_ops);
