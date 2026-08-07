import { describe, it, expect } from "vitest";
import { applyTombstones } from "@/lib/comments/tombstone";

/**
 * Two display rules that a browser found and the test suite had not.
 *
 * The delete confirmation now says what will actually happen — a comment with
 * live replies becomes "[deleted]" and the thread survives; one without simply
 * goes. The old native `confirm("Delete this comment?")` implied the second in
 * both cases.
 *
 * The wording is chosen by a predicate in the component, and the risk is that
 * it drifts from what `applyTombstones` actually does on the server: the
 * dialog would promise the replies survive and they would not, or the reverse.
 * These pin the two against each other.
 */

/** The component's predicate, mirrored. Kept in step with CommentThread. */
function keepsThread(
  pending: { id: number; parentId: number | null },
  comments: { parentId: number | null; id: number; isDeleted?: boolean }[]
) {
  return (
    pending.parentId === null &&
    comments.some((c) => c.parentId === pending.id && !c.isDeleted)
  );
}

const row = (id: number, parentId: number | null, deleted = false) => ({
  id,
  parentId,
  content: `body ${id}`,
  deletedAt: deleted ? new Date() : null,
  isDeleted: deleted,
  authorFirstName: "Ada",
  authorLastName: "L",
  authorId: 1,
});

describe("the delete dialog's wording matches what deletion does", () => {
  it("promises the thread survives exactly when it does", () => {
    const comments = [row(1, null), row(2, 1)];

    // The dialog says "replies will stay readable"...
    expect(keepsThread({ id: 1, parentId: null }, comments)).toBe(true);

    // ...and the server agrees: the parent stays as a tombstone.
    const after = applyTombstones(
      comments.map((c) => (c.id === 1 ? { ...c, deletedAt: new Date() } : c))
    );
    expect(after.map((c) => c.id)).toEqual([1, 2]);
    expect(after.find((c) => c.id === 1)!.isDeleted).toBe(true);
  });

  it("does not promise it when the comment has no replies", () => {
    const comments = [row(1, null)];
    expect(keepsThread({ id: 1, parentId: null }, comments)).toBe(false);

    const after = applyTombstones([{ ...comments[0], deletedAt: new Date() }]);
    expect(after).toHaveLength(0);
  });

  it("does not promise it when every reply is already deleted", () => {
    const comments = [row(1, null), row(2, 1, true)];
    expect(keepsThread({ id: 1, parentId: null }, comments)).toBe(false);

    const after = applyTombstones(
      comments.map((c) => (c.id === 1 ? { ...c, deletedAt: new Date() } : c))
    );
    expect(after).toHaveLength(0);
  });

  it("never promises it for a reply, which can hold nothing", () => {
    // Nesting is capped at one level, so a reply is always a leaf.
    const comments = [row(1, null), row(2, 1)];
    expect(keepsThread({ id: 2, parentId: 1 }, comments)).toBe(false);
  });
});
