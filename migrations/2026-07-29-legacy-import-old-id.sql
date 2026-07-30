-- Legacy FrumToronto (MSSQL) import support — 2026-07-29
--
-- Adds old_id mapping columns so every legacy import is re-runnable instead of
-- duplicating rows. events/classifieds/businesses/shuls/shiurim already had this
-- pattern; simchas, shiva_notifications, kosher_alerts and blog_posts did not.
--
-- The partial UNIQUE indexes are the real safety net: they make a duplicate
-- import impossible at the database level, not merely unlikely in script logic.
-- WHERE old_id IS NOT NULL keeps them out of the way of natively-created rows,
-- which all have old_id NULL and would otherwise collide with each other.
--
-- Additive and non-destructive: no drops, no data rewrites.

ALTER TABLE simchas             ADD COLUMN IF NOT EXISTS old_id INTEGER;
ALTER TABLE shiva_notifications ADD COLUMN IF NOT EXISTS old_id INTEGER;
ALTER TABLE kosher_alerts       ADD COLUMN IF NOT EXISTS old_id INTEGER;
ALTER TABLE blog_posts          ADD COLUMN IF NOT EXISTS old_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS simchas_old_id_key
  ON simchas (old_id) WHERE old_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS shiva_notifications_old_id_key
  ON shiva_notifications (old_id) WHERE old_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS kosher_alerts_old_id_key
  ON kosher_alerts (old_id) WHERE old_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_old_id_key
  ON blog_posts (old_id) WHERE old_id IS NOT NULL;

-- email_subscribers.old_member_id already existed in the schema but was never
-- written to by any code. The member import populates it, so it needs the same
-- guarantee.
CREATE UNIQUE INDEX IF NOT EXISTS email_subscribers_old_member_id_key
  ON email_subscribers (old_member_id) WHERE old_member_id IS NOT NULL;

-- The public /simchas page filters by type and sorts by created_at. With ~16.5k
-- rows that ordering needs an index to stay off a full sort.
CREATE INDEX IF NOT EXISTS idx_simchas_listing
  ON simchas (approval_status, is_active, created_at DESC);
