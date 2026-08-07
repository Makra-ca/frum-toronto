---
name: only-the-author-edits-a-comment
description: Comments become editable by their author only; an edit is re-moderated and disclosed
type: decision
date: 2026-08-07
status: accepted
---

**Decision:** Comments are editable, under three rules:

1. **Only the author edits.** Not admins, not `canManageAskTheRabbi` holders.
2. **An edit is re-moderated** exactly like a new comment — same
   `resolveCommentOutcome`, same inputs.
3. **The edit is disclosed** — `edited_at` is stamped and shown next to the
   comment.

No time window.

**Context:** Neither surface had a `PATCH` route at all. A comment was final
once posted, so fixing a typo meant delete-and-repost — which on a reply loses
its place in the thread, and (before tombstones) took the whole thread with it.

**Chose over:**

- *Letting admins edit too* — rejected. An admin who can rewrite someone else's
  words can put words in their mouth **under their name**, which is worse than
  anything moderation is trying to prevent. Moderation already has the
  proportionate tools: hold, reject, delete. This is why the ownership check has
  no admin bypass, unusually for this codebase.
- *Leaving the approval status alone on edit* — rejected, and this is the
  load-bearing one. A site set to hold-for-approval would be trivially
  defeated: post something innocuous, wait for approval, then edit it into
  whatever you wanted to say. Re-running the same decision closes that without
  a second rulebook.
- *A 5–15 minute edit window*, as most forums use — rejected. A window means a
  typo noticed an hour later can only be fixed by deleting, and rule 2 already
  removes the reason those windows exist.
- *Silently keeping the old text* — rejected. A reply quoting a comment that
  has since changed misleads everyone reading afterwards, so `edited_at` is
  shown rather than merely stored.
- *Editing a deleted comment* — refused with **410 Gone**, not 403: the comment
  existed and the caller owned it, which is a different thing to tell them.
  Ownership is checked **first**, so a stranger is told "not yours" rather than
  learning that a comment they cannot see was deleted.

**Consequences:**

- `resolveCommentOutcome` (`src/lib/comments/resolve.ts`) is now the single
  place the moderation inputs are read, shared by all four routes — post and
  edit, on each surface. The create paths were folded onto it in the same
  commit; a create/edit divergence here is a hole, not an inconsistency.
- An edit that lands back on `pending` is **removed from the client list**
  rather than left showing the new text. Leaving it would tell the author their
  edit went live when it did not.
- Edits are audited **only when the comment had already been public**. That is
  the bait-and-switch case, where people read one thing and the record now says
  another, and the audit entry is the only place the original survives. A
  pending comment nobody saw is not logged — it would bury the entries worth
  finding.
- `edited_at` is separate from `updated_at`, which also moves on approve and
  reject and so cannot honestly be shown to a reader as "the author changed
  this".

Related: [[deleted-comments-are-tombstoned]],
[[blog-comment-moderation-controls]]
