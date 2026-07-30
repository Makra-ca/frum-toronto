-- Legacy shiva import support — 2026-07-29
--
-- shiva_notifications models *structured* shiva logistics (address, hours,
-- davening times, levaya, zoom, minyan, meals, donations). The 3,553 legacy
-- notices are free-text bereavement announcements: one prose block naming the
-- niftar, the mourners, the funeral and the shiva house together.
--
-- There was no column for that prose. The alternative was to overload an
-- existing one — levaya_info is the closest fit and still wrong, since the text
-- is a whole notice rather than funeral details. A mislabeled column is worse
-- than a new one: every future reader of levaya_info would be misled.
--
-- notice_text is therefore the verbatim (entity-decoded, tag-stripped) legacy
-- body. It is NULL for every natively-created notice, so it doubles as a marker
-- for "this row came from the old site and is prose, not structured fields".
--
-- Additive and non-destructive.

ALTER TABLE shiva_notifications ADD COLUMN IF NOT EXISTS notice_text TEXT;

-- The public shiva page filters on shiva_end >= today; the admin list orders by
-- recency. Every legacy row is long expired, so this keeps them out of the way
-- of the live query.
CREATE INDEX IF NOT EXISTS idx_shiva_notifications_window
  ON shiva_notifications (shiva_end DESC, shiva_start DESC);
