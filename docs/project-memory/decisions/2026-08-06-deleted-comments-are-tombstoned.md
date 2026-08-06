---
name: deleted-comments-are-tombstoned
description: Deleting a comment that has replies leaves a tombstone; the replies survive. NOT YET BUILT
type: decision
date: 2026-08-06
status: accepted
---

**Decision:** When someone deletes a comment that has replies, the comment
becomes a tombstone — *"This comment was deleted"* — and the **replies stay
readable**. A comment with no replies is hard-deleted, because there is nothing
to preserve.

**⚠️ DECIDED, NOT BUILT.** Today's code still does the opposite: deleting a
top-level comment silently deletes every reply to it.

```js
// src/app/api/blog/[slug]/comments/route.ts — current behaviour
if (comment.parentId === null) {
  await db.delete(blogComments).where(eq(blogComments.parentId, commentId));
}
```

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

1. `deleted_at` on `blog_comments` and `ask_the_rabbi_comments` (both databases)
2. Both DELETE routes: tombstone if the comment has replies, hard-delete if not.
   **Blank the content** — a deletion should actually remove the words, not hide
   them behind a flag.
3. `CommentThread`: render the tombstone
4. Both GET routes: return tombstoned rows so the thread structure survives
5. Tests, including: deleting a parent leaves the replies readable

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
