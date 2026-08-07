---
name: deleted-comments-are-tombstoned
description: Deleting a comment that has replies leaves a tombstone; the replies survive. BUILT 2026-08-06
type: decision
date: 2026-08-06
status: accepted
---

**Decision:** When someone deletes a comment that has replies, the comment
becomes a tombstone — *"This comment was deleted"* — and the **replies stay
readable**. A comment with no replies is hard-deleted, because there is nothing
to preserve.

**✅ BUILT 2026-08-06.** All four delete paths now soft-delete, and
`applyTombstones` in `src/lib/comments/tombstone.ts` decides what a reader sees.

What the code actually did before, which was worse than "the opposite" — it was
three different things depending on the button:

| Path | Old behaviour |
|---|---|
| User deletes own top-level | App-level cascade — replies **destroyed** |
| Admin deletes via the queue | Bare `DELETE` — replies **orphaned**: they matched no parent, were not top-level, so `CommentThread` rendered them nowhere while they sat in the table forever |
| Admin deletes an ATR comment | Soft delete (`is_active = false`) only |

And `blog_comments.parent_id` was a bare `integer` with **no foreign key at
all**, so nothing at the database level prevented any of it.


**Context:** The split across platforms is real and reasoned. YouTube, Facebook
and Instagram take the replies with the parent. Reddit, Hacker News and Disqus
tombstone and keep them.

Social feeds delete because a reply is usually a reaction, worthless without its
parent. Discussion sites preserve because a reply is often a contribution in its
own right — and **deleting three people's writing because a fourth changed their
mind is taking something that is not yours to take.** FrumToronto is the second
kind: real names, Torah articles, considered replies.

**Chose over:**

- *Cascade (current).* No work, and one person's decision silently erases other
  people's words with no warning that it will.
- *Cascade with a warning.* Honest, costs nothing structurally, replies still go.
- *Refuse deletion once anyone has replied* (Hacker News). Cleanest ethically,
  but it strands someone who genuinely regrets a comment at exactly the moment
  they most want it gone.

**Scope — smaller than it first looked:**

The delete **button already exists**. `src/components/shared/CommentThread.tsx`
has it, gated on `canModerate || currentUserId === comment.authorId`, and is used
by **both** blog (via the thin `BlogComments.tsx` wrapper) and Ask the Rabbi. One
shared component means one render change covers both surfaces.

Remaining work:
**What shipped:**

1. `migrations/2026-08-06-comment-tombstones.sql` — `deleted_at` on both comment
   tables, the missing `blog_comments.parent_id` foreign key, and Ask the
   Rabbi's realigned to `ON DELETE CASCADE`. Applied to primary and test.
2. All four delete routes soft-delete. The two app-level cascades are gone.
3. `applyTombstones()` in `src/lib/comments/tombstone.ts` — the single rule,
   applied by both public GETs. Text and author are blanked **server-side**; a
   tombstone that shipped the original and hid it in CSS would still be in the
   JSON.
4. `CommentThread` renders the tombstone and drops its Reply and Delete
   actions, and its optimistic delete now applies the same rule — filtering the
   row out locally reproduced the orphaning bug in the UI until a reload.
5. Both admin queues and the pending badge exclude deleted rows, so the count
   cannot outrun the list.
6. 14 unit + 10 integration tests; six verified to go red against the old
   delete behaviour.

**Consequences:**

- Threading is one level deep, so a "thread" is a parent plus flat replies —
  no recursion to reason about.
- Low stakes to get right now: **one comment exists on the entire site.**
  Cheaper to fix before there are threads than after.

## A correction worth keeping

This started from a claim of mine that members *could not delete their own
comments at all*. **That was wrong.** I grepped `BlogComments.tsx` for "delete",
found nothing, and concluded there was no button — without noticing the file is
a 20-line wrapper that delegates to `CommentThread`, where the button lives.

That is the same error I had flagged in another session's `broadcast_at` claim
earlier the same day. **A grep proves something about the file you searched, not
about the behaviour** — and in a codebase with shared components those are
routinely different things.

Related: [[blog-comments-stay-open]]
