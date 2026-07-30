-- User submissions: view, edit, and hear back
-- Spec: docs/superpowers/specs/2026-07-30-user-submissions-design.md
--
-- All additive. No column is dropped, no data is rewritten.

-- ---------------------------------------------------------------------------
-- broadcast_at — the real guard against re-announcing an item
--
-- Approving does not merely flip a status, it can email every subscriber. A
-- transition-only rule ("only broadcast on pending -> approved") is defeated by
--     approved (broadcast) -> owner edits -> pending_edit -> admin rejects
--       -> owner edits again -> pending -> approved  => BROADCAST AGAIN
-- because `rejected` erases the fact the row was ever published.
--
-- A broadcast is a fact about the row, not about a transition. Gate on
-- broadcast_at IS NULL and stamp it when it fires, and "at most one broadcast
-- per item, ever" holds down every path.
--
-- Backfilled for rows that are already approved: they have been announced (or
-- the moment has passed), and either way must never be announced again.
-- ---------------------------------------------------------------------------
ALTER TABLE events              ADD COLUMN IF NOT EXISTS broadcast_at timestamp;
ALTER TABLE simchas             ADD COLUMN IF NOT EXISTS broadcast_at timestamp;
ALTER TABLE classifieds         ADD COLUMN IF NOT EXISTS broadcast_at timestamp;
ALTER TABLE kosher_alerts       ADD COLUMN IF NOT EXISTS broadcast_at timestamp;
ALTER TABLE alerts              ADD COLUMN IF NOT EXISTS broadcast_at timestamp;
ALTER TABLE shiva_notifications ADD COLUMN IF NOT EXISTS broadcast_at timestamp;
ALTER TABLE tehillim_list       ADD COLUMN IF NOT EXISTS broadcast_at timestamp;
ALTER TABLE blog_posts          ADD COLUMN IF NOT EXISTS broadcast_at timestamp;

UPDATE events              SET broadcast_at = COALESCE(created_at, now()) WHERE approval_status = 'approved' AND broadcast_at IS NULL;
UPDATE simchas             SET broadcast_at = COALESCE(created_at, now()) WHERE approval_status = 'approved' AND broadcast_at IS NULL;
UPDATE classifieds         SET broadcast_at = COALESCE(created_at, now()) WHERE approval_status = 'approved' AND broadcast_at IS NULL;
UPDATE kosher_alerts       SET broadcast_at = COALESCE(created_at, now()) WHERE approval_status = 'approved' AND broadcast_at IS NULL;
UPDATE alerts              SET broadcast_at = COALESCE(created_at, now()) WHERE approval_status = 'approved' AND broadcast_at IS NULL;
UPDATE shiva_notifications SET broadcast_at = COALESCE(created_at, now()) WHERE approval_status = 'approved' AND broadcast_at IS NULL;
UPDATE tehillim_list       SET broadcast_at = COALESCE(created_at, now()) WHERE approval_status = 'approved' AND broadcast_at IS NULL;
UPDATE blog_posts          SET broadcast_at = COALESCE(created_at, now()) WHERE approval_status = 'approved' AND broadcast_at IS NULL;

-- ---------------------------------------------------------------------------
-- rejection_reason — optional, shown to the submitter and in the email
-- ---------------------------------------------------------------------------
ALTER TABLE events              ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE simchas             ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE classifieds         ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE kosher_alerts       ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE alerts              ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE shiva_notifications ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE tehillim_list       ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE blog_posts          ADD COLUMN IF NOT EXISTS rejection_reason text;

-- ---------------------------------------------------------------------------
-- updated_at — concurrency detection, and so a corrected old item resurfaces
-- at the top of the approvals queue instead of sinking by created_at.
--
-- blog_posts already has one. NOTE: a DEFAULT never fires again after insert —
-- the value only moves because the Drizzle schema declares $onUpdate. Without
-- that, every column here is frozen at creation and both features are inert.
-- ---------------------------------------------------------------------------
ALTER TABLE events              ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
ALTER TABLE simchas             ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
ALTER TABLE classifieds         ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
ALTER TABLE kosher_alerts       ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
ALTER TABLE alerts              ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
ALTER TABLE shiva_notifications ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
ALTER TABLE tehillim_list       ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_events_updated      ON events (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_simchas_updated     ON simchas (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_classifieds_updated ON classifieds (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_kosher_alerts_updated ON kosher_alerts (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_updated      ON alerts (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_shiva_updated       ON shiva_notifications (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tehillim_updated    ON tehillim_list (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_updated  ON blog_posts (updated_at DESC);
