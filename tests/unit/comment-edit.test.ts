import { describe, it, expect } from "vitest";
import {
  refuseCommentEdit,
  EDIT_REFUSAL_MESSAGES,
  EDIT_REFUSAL_STATUS,
} from "@/lib/comments/edit";

/**
 * Neither comment surface had a PATCH route, so a comment was final once
 * posted. These pin who may edit and, as much, who may not.
 */

const AUTHOR = 7;
const STRANGER = 8;

describe("the author", () => {
  it("may edit their own live comment", () => {
    expect(
      refuseCommentEdit({ authorId: AUTHOR, deletedAt: null }, AUTHOR)
    ).toBeNull();
  });

  it("may not edit it once deleted", () => {
    // Editing a tombstone would put text back on a comment whose removal other
    // people can already see.
    expect(
      refuseCommentEdit({ authorId: AUTHOR, deletedAt: new Date() }, AUTHOR)
    ).toBe("deleted");
  });
});

describe("anyone else, including an admin", () => {
  it("may not edit someone else's comment", () => {
    // Deliberate: an admin who can rewrite someone's words can put words in
    // their mouth under their name. Moderation gets hold, reject and delete.
    expect(
      refuseCommentEdit({ authorId: AUTHOR, deletedAt: null }, STRANGER)
    ).toBe("not_author");
  });

  it("is told it is not theirs, NOT that it was deleted", () => {
    // Ownership is checked first on purpose: telling a stranger that a comment
    // was deleted leaks a little about content that is not theirs.
    expect(
      refuseCommentEdit({ authorId: AUTHOR, deletedAt: new Date() }, STRANGER)
    ).toBe("not_author");
  });
});

describe("the refusals", () => {
  it("each carry a message and a status", () => {
    for (const reason of ["not_author", "deleted"] as const) {
      expect(EDIT_REFUSAL_MESSAGES[reason]).toBeTruthy();
      expect(EDIT_REFUSAL_STATUS[reason]).toBeGreaterThanOrEqual(400);
    }
  });

  it("distinguishes 403 from 410", () => {
    // Gone, not Forbidden: with "deleted" the comment existed and the caller
    // owned it, which is a different thing to tell them.
    expect(EDIT_REFUSAL_STATUS.not_author).toBe(403);
    expect(EDIT_REFUSAL_STATUS.deleted).toBe(410);
  });
});
