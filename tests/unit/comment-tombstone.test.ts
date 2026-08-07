import { describe, it, expect } from "vitest";
import {
  applyTombstones,
  hasLiveReplies,
  TOMBSTONE_CONTENT,
} from "@/lib/comments/tombstone";

/**
 * Deleting a comment used to mean three different things:
 *
 *   user deletes own top-level   -> app-level cascade, replies DESTROYED
 *   admin deletes via the queue  -> bare DELETE, replies ORPHANED (invisible
 *                                   forever, still in the table)
 *   admin deletes an ATR comment -> soft delete only
 *
 * One rule now. The cases below are the ones that decide whether a thread
 * survives its parent.
 */

const row = (
  id: number,
  parentId: number | null,
  deletedAt: Date | null = null
) => ({
  id,
  parentId,
  content: `body ${id}`,
  deletedAt,
  authorFirstName: "Ada",
  authorLastName: "Lovelace",
  authorId: 7,
});

describe("a deleted comment nobody replied to", () => {
  it("disappears entirely", () => {
    const out = applyTombstones([row(1, null, new Date())]);
    expect(out).toHaveLength(0);
  });

  it("disappears even when its only reply is also deleted", () => {
    const out = applyTombstones([
      row(1, null, new Date()),
      row(2, 1, new Date()),
    ]);
    expect(out).toHaveLength(0);
  });
});

describe("a deleted comment with a live reply", () => {
  const rows = [row(1, null, new Date()), row(2, 1)];

  it("stays, so the reply keeps its place in the thread", () => {
    // The orphaning bug: without the parent, the reply matched no parent and
    // was not top-level, so it rendered nowhere at all.
    const out = applyTombstones(rows);
    expect(out.map((c) => c.id)).toEqual([1, 2]);
  });

  it("is marked deleted and shows the placeholder", () => {
    const [parent] = applyTombstones(rows);
    expect(parent.isDeleted).toBe(true);
    expect(parent.content).toBe(TOMBSTONE_CONTENT);
  });

  it("leaks neither the original text nor the author", () => {
    // Blanking must happen server-side. A tombstone that shipped the real text
    // and merely hid it would be visible in the JSON response and in devtools.
    const [parent] = applyTombstones(rows);
    expect(parent.content).not.toContain("body 1");
    expect(parent.authorFirstName).toBeNull();
    expect(parent.authorLastName).toBeNull();
    expect(parent.authorId).toBeNull();
  });

  it("leaves the surviving reply completely untouched", () => {
    const [, reply] = applyTombstones(rows);
    expect(reply.isDeleted).toBe(false);
    expect(reply.content).toBe("body 2");
    expect(reply.authorFirstName).toBe("Ada");
  });
});

describe("a deleted reply", () => {
  it("always disappears — nothing hangs off it", () => {
    // Nesting is capped at one level, so a reply can never be a parent.
    const out = applyTombstones([row(1, null), row(2, 1, new Date())]);
    expect(out.map((c) => c.id)).toEqual([1]);
  });

  it("does not keep a deleted parent alive", () => {
    const out = applyTombstones([
      row(1, null, new Date()),
      row(2, 1, new Date()),
      row(3, 1, new Date()),
    ]);
    expect(out).toHaveLength(0);
  });

  it("still lets a sibling keep the parent alive", () => {
    const out = applyTombstones([
      row(1, null, new Date()),
      row(2, 1, new Date()),
      row(3, 1),
    ]);
    expect(out.map((c) => c.id)).toEqual([1, 3]);
  });
});

describe("ordinary threads", () => {
  it("pass through unchanged when nothing is deleted", () => {
    const rows = [row(1, null), row(2, 1), row(3, null)];
    const out = applyTombstones(rows);
    expect(out.map((c) => c.id)).toEqual([1, 2, 3]);
    expect(out.every((c) => !c.isDeleted)).toBe(true);
  });

  it("preserves input order", () => {
    // The routes order by createdAt; this must not reshuffle them.
    const out = applyTombstones([row(5, null), row(1, null), row(9, 5)]);
    expect(out.map((c) => c.id)).toEqual([5, 1, 9]);
  });
});

describe("hasLiveReplies", () => {
  it("is true when a reply survives", () => {
    expect(hasLiveReplies(1, [row(2, 1)])).toBe(true);
  });

  it("is false when every reply is deleted", () => {
    expect(hasLiveReplies(1, [row(2, 1, new Date())])).toBe(false);
  });

  it("ignores replies to other comments", () => {
    expect(hasLiveReplies(1, [row(2, 99)])).toBe(false);
  });
});
