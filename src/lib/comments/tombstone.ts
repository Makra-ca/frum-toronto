/**
 * What a reader sees where a deleted comment used to be.
 *
 * Deleting used to mean three different things depending on which button was
 * pressed: a user deleting their own top-level comment destroyed every reply,
 * an admin deleting the same comment orphaned them (they matched no parent and
 * were not top-level, so they rendered nowhere and stayed in the table
 * forever), and an admin deleting an Ask the Rabbi comment merely hid it.
 *
 * One rule now: a comment is soft-deleted, and
 *
 *   - if nothing replied to it, it disappears;
 *   - if replies survive, it becomes a TOMBSTONE — the thread keeps its shape
 *     and the replies keep their context, but the text and the author are gone.
 *
 * This is the model discussion sites use (Reddit, Hacker News, Disqus) rather
 * than the cascade social feeds use, because here a reply is usually a
 * standalone answer worth keeping. Someone answering a halachic question should
 * not lose their answer because the asker deleted the question.
 */

/** The visible stand-in for a removed comment. */
export const TOMBSTONE_CONTENT = "[deleted]";

export type CommentRow = {
  id: number;
  parentId: number | null;
  content: string;
  deletedAt: Date | string | null;
  authorFirstName?: string | null;
  authorLastName?: string | null;
  authorId?: number | null;
};

export type VisibleComment<T extends CommentRow> = Omit<
  T,
  "content" | "authorFirstName" | "authorLastName"
> & {
  content: string;
  authorFirstName: string | null;
  authorLastName: string | null;
  /** True when this row is only present to hold its replies in place. */
  isDeleted: boolean;
};

/**
 * Drops deleted comments that nobody replied to, and blanks the ones that stay.
 *
 * Blanking happens HERE rather than in the client, because a tombstone that
 * shipped the original text and author to the browser and merely hid them
 * would not be a deletion at all — it would be visible in devtools and in the
 * JSON response.
 *
 * Nesting is capped at one level on both surfaces, so "has a live reply" only
 * ever needs to look one deep.
 */
export function applyTombstones<T extends CommentRow>(
  rows: T[]
): VisibleComment<T>[] {
  const parentsWithLiveReplies = new Set<number>();
  for (const row of rows) {
    if (row.parentId !== null && !row.deletedAt) {
      parentsWithLiveReplies.add(row.parentId);
    }
  }

  const visible: VisibleComment<T>[] = [];

  for (const row of rows) {
    if (!row.deletedAt) {
      visible.push({ ...row, isDeleted: false } as VisibleComment<T>);
      continue;
    }

    // A deleted reply always goes: nothing hangs off it.
    if (row.parentId !== null) continue;

    // A deleted top-level comment stays only to hold its replies.
    if (!parentsWithLiveReplies.has(row.id)) continue;

    visible.push({
      ...row,
      content: TOMBSTONE_CONTENT,
      authorFirstName: null,
      authorLastName: null,
      authorId: null,
      isDeleted: true,
    } as VisibleComment<T>);
  }

  return visible;
}

/**
 * Whether a comment still needs to exist after being deleted.
 *
 * Callers that want to hard-delete (only the user-purge path does) can use this
 * to check they are not about to take live replies with them.
 */
export function hasLiveReplies(
  commentId: number,
  rows: Pick<CommentRow, "parentId" | "deletedAt">[]
): boolean {
  return rows.some((r) => r.parentId === commentId && !r.deletedAt);
}
