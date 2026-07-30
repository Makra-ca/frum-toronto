-- Search indexes for the blog archive — 2026-07-30
--
-- /blog gained text search over 3,051 posts (mostly legacy imports). Both
-- searchBlog() and the list query use ILIKE '%term%' and similarity(), neither
-- of which a btree index can serve.
--
-- The body is included because legacy titles are often just a date
-- ("Halacha For Today: Monday, 27 Cheshvan 5773"), so searching titles alone
-- would miss almost everything in those 1,211 posts.
--
-- Additive and non-destructive.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_blog_posts_title_trgm
  ON blog_posts USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_blog_posts_excerpt_trgm
  ON blog_posts USING gin (excerpt gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_blog_posts_content_trgm
  ON blog_posts USING gin (content gin_trgm_ops);
