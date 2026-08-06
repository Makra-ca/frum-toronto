---
name: blog-comment-moderation-controls
description: Blog comments get a real site-wide setting and honour users.commentPermission; both apply forward-only
type: decision
date: 2026-08-06
status: accepted
---

**Decision:** Blog comment moderation is governed by two controls, combined in
one pure function (`src/lib/blog/comment-moderation.ts`):

1. **Policy** — the post's own `commentModeration` override, falling back to the
   site-wide `blog_comment_moderation` setting, now editable at
   **Admin → Programs → Blog → Comments → Comment Settings** (its own page).
   The default stays **publish immediately**.
2. **Person** — `users.commentPermission`. `blocked` returns **403** before any
   row is written; `requires_approval` (and its legacy alias `moderated`)
   writes the comment as `pending`.

Both apply **forward-only**. Changing someone's permission never touches
comments they already posted.

**Context:** The comment route had read a `blog_comment_moderation` key from
`site_settings` since the blog shipped, but nothing could ever write it — there
was no admin screen and no row, so the lookup always missed and fell through to
auto-publish. Production confirmed it: `site_settings` held exactly one row, a
PayPal product id.

Worse, the route never read `users.commentPermission` at all. Ask the Rabbi
enforced all three values; the blog enforced none. **An account set to "Blocked"
in Admin → Users could still comment on any blog post**, and one set to
"Requires Approval" published instantly. The buttons looked like they worked.

**Chose over:**

- *Putting the setting on Admin → Settings* — rejected by the owner in favour of
  its own page near the queue it governs.
- *Putting it on the comments queue page itself* — that page is a list view that
  reloads on every approve/reject; a settings form inside that render cycle
  would either fight it or go stale.
- *Defaulting to hold-for-approval* — would silently start queueing comments on
  3,058 posts, and with one comment on the whole site that queue would be easy
  to forget. The default preserves existing behaviour; the admin opts in.
- *Retroactive blocking* (hiding everything a newly-blocked person wrote) —
  a bulk change with no undo, and it would fire on "Requires Approval" too
  unless the two were split. Every other permission in the system is
  forward-only; this matches.
- *Letting `blocked` produce a pending row* — rejected. The text would sit in
  the moderation queue where an admin could approve it without noticing who
  wrote it. A block must write nothing.

**Consequences:**

- `decideBlogComment()` is the single place the rules live, so the route cannot
  drift from them again. 27 unit tests pin the rules, 6 integration tests pin
  that the route calls them — verified to go red against the old behaviour.
- An unrecognised post-level override defers to the site setting rather than
  being coerced to "open", so a bad write cannot silently disable moderation for
  one post while the admin screen shows the site as locked down.
- Admins bypass both controls, matching Ask the Rabbi's manager bypass.
- `canAutoApproveBlog` was deliberately **not** wired in. Ask the Rabbi's
  equivalent flag governs comments only because ATR questions are answered
  rather than approved, so it had nothing else to govern. Blog posts *are*
  approved, so that flag already has a job; including it here would silently
  widen it.

Related: [[deleted-comments-are-tombstoned]]
