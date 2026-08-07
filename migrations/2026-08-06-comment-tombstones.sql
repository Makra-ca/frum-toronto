-- Deleted comments become tombstones instead of destroying the thread.
--
-- Two problems this closes.
--
-- 1. Deleting meant three different things depending on which button you used:
--      user deletes own top-level  -> app-level cascade, replies DESTROYED
--      admin deletes via queue     -> bare DELETE, replies ORPHANED
--      admin deletes an ATR comment-> soft delete (is_active = false)
--    Orphaned replies match no parent and are not top-level, so CommentThread
--    renders them nowhere. They stayed in the table, invisible, forever.
--
-- 2. blog_comments.parent_id had NO foreign key at all — it was a bare
--    integer column — so nothing at the database level prevented any of it.
--    ask_the_rabbi_comments.parent_id already self-referenced.
--
-- Verified before running: 0 orphaned rows and 0 replies on both the primary
-- and the test branch, so the constraint can be added without a cleanup pass.

-- ---------------------------------------------------------------------------
-- deleted_at: the single signal that a comment was removed.
--
-- Separate from is_active, which is an admin hide/show and says nothing about
-- who removed a comment or whether its replies should survive.
-- ---------------------------------------------------------------------------
ALTER TABLE blog_comments
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

ALTER TABLE ask_the_rabbi_comments
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- ---------------------------------------------------------------------------
-- The missing foreign key.
--
-- ON DELETE CASCADE, so the one path that still hard-deletes — purging a user
-- account with their content — cannot leave an orphan behind. Soft delete is
-- the normal route and never fires this.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'blog_comments_parent_id_fkey'
  ) THEN
    ALTER TABLE blog_comments
      ADD CONSTRAINT blog_comments_parent_id_fkey
      FOREIGN KEY (parent_id) REFERENCES blog_comments(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ask the Rabbi's constraint exists but is NO ACTION, so a hard delete of a
-- parent raises rather than cascading. Aligned with the blog for one rule.
DO $$
DECLARE
  con_name text;
  del_type "char";
BEGIN
  -- The existing self-reference, whatever it happens to be named.
  SELECT conname, confdeltype INTO con_name, del_type
  FROM pg_constraint
  WHERE conrelid = 'ask_the_rabbi_comments'::regclass
    AND contype = 'f'
    AND confrelid = 'ask_the_rabbi_comments'::regclass
  LIMIT 1;

  -- 'c' is CASCADE. Anything else gets replaced; already-CASCADE is left alone
  -- so re-running this file is a no-op.
  IF con_name IS NOT NULL AND del_type IS DISTINCT FROM 'c' THEN
    EXECUTE format(
      'ALTER TABLE ask_the_rabbi_comments DROP CONSTRAINT %I', con_name
    );
    con_name := NULL;
  END IF;

  IF con_name IS NULL THEN
    ALTER TABLE ask_the_rabbi_comments
      ADD CONSTRAINT ask_the_rabbi_comments_parent_id_fkey
      FOREIGN KEY (parent_id) REFERENCES ask_the_rabbi_comments(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Reading a thread now asks "is this row deleted, and does it still have live
-- replies", so both listing indexes carry deleted_at.
CREATE INDEX IF NOT EXISTS idx_blog_comments_thread
  ON blog_comments (post_id, parent_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_atr_comments_thread
  ON ask_the_rabbi_comments (question_id, parent_id, deleted_at);
