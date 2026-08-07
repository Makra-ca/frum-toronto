/**
 * Editing a comment.
 *
 * Neither surface had a PATCH at all: once posted, a comment was final, so
 * fixing a typo meant deleting and reposting — which on a reply loses its
 * place in the thread and, before tombstones, took the whole thread with it.
 *
 * Three rules, and the reasoning matters more than the code.
 *
 * 1. ONLY THE AUTHOR EDITS. Not admins. An admin who can rewrite someone
 *    else's words can put words in their mouth under their name, which is
 *    worse than anything moderation is trying to prevent. Admins already have
 *    the proportionate tools: hold, reject, delete.
 *
 * 2. AN EDIT IS RE-MODERATED exactly like a new comment. Otherwise a site set
 *    to "hold for approval" is trivially defeated — post something innocuous,
 *    wait for approval, then edit it into whatever you wanted to say. Running
 *    the same `decideComment` on edit closes that without a second rulebook.
 *
 * 3. THE EDIT IS DISCLOSED. `editedAt` is stamped and shown, because a reply
 *    quoting a comment that has since changed is misleading to everyone
 *    reading afterwards.
 *
 * There is deliberately NO time window. A window would mean a typo noticed an
 * hour later can only be fixed by deleting — and rule 2 already removes the
 * reason most sites impose one.
 */

export type CommentEditSubject = {
  authorId: number;
  deletedAt: Date | string | null;
};

export type CommentEditRefusal = "not_author" | "deleted";

/**
 * Why this person may not edit this comment, or null if they may.
 *
 * Returns a reason rather than a boolean so the route can say something true —
 * "this comment was deleted" and "this is not yours" are different situations
 * and deserve different words.
 */
export function refuseCommentEdit(
  comment: CommentEditSubject,
  userId: number
): CommentEditRefusal | null {
  // Ownership first. Telling a stranger that a comment they cannot see was
  // deleted leaks a little about content that is not theirs.
  if (comment.authorId !== userId) return "not_author";
  if (comment.deletedAt) return "deleted";
  return null;
}

export const EDIT_REFUSAL_MESSAGES: Record<CommentEditRefusal, string> = {
  not_author: "You can only edit your own comments.",
  deleted: "This comment was deleted and can no longer be edited.",
};

export const EDIT_REFUSAL_STATUS: Record<CommentEditRefusal, number> = {
  not_author: 403,
  // Gone, not Forbidden: the comment existed and the caller owned it.
  deleted: 410,
};
