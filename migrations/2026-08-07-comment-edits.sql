-- Comments become editable by their author.
--
-- Neither surface had a PATCH route, so a comment was final once posted and
-- fixing a typo meant delete-and-repost — which on a reply loses its place in
-- the thread.
--
-- `edited_at` is disclosure, not bookkeeping. A reply quoting a comment that
-- has since changed misleads everyone reading afterwards, so the fact that an
-- edit happened is shown next to the comment.
--
-- Nothing here changes existing rows: NULL means "never edited", which is true
-- of every comment written before this.

ALTER TABLE blog_comments
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP;

ALTER TABLE ask_the_rabbi_comments
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP;
