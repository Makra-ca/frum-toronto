import { describe, it, expect } from "vitest";
import { canDeleteUser } from "@/lib/admin/user-deletion-guards";
import {
  ARCHIVE_USER_ID,
  OWNED_TABLES,
  CONTENT_TABLES,
  ATTRIBUTION_TABLES,
  ALWAYS_DESTROYED,
} from "@/lib/admin/user-deletion-tables";

/**
 * Deletion is the one irreversible action in the admin panel, so the refusals
 * are pure functions and pinned here rather than only exercised through a route.
 */

const ACTOR = 2;

describe("canDeleteUser", () => {
  it("allows an ordinary member", () => {
    expect(
      canDeleteUser({ targetId: 500, targetRole: "member", actorId: ACTOR })
    ).toEqual({ allowed: true });
  });

  it("refuses the admin deleting themselves", () => {
    const v = canDeleteUser({ targetId: ACTOR, targetRole: "admin", actorId: ACTOR });
    expect(v.allowed).toBe(false);
  });

  it("refuses ANY admin account, not just the last one", () => {
    // Deliberately blanket. Unlike a demotion — which a second admin makes safe
    // — a deletion cannot be undone by promoting someone else afterwards.
    // Demote first, then delete: two deliberate steps for an irreversible act.
    const v = canDeleteUser({ targetId: 999, targetRole: "admin", actorId: ACTOR });
    expect(v.allowed).toBe(false);
    if (!v.allowed) expect(v.reason).toMatch(/admin/i);
  });

  it("refuses the Archive account", () => {
    // Reassignment moves content TO this account, and it already owns 283
    // imported posts. Deleting it is incoherent.
    const v = canDeleteUser({
      targetId: ARCHIVE_USER_ID,
      targetRole: "member",
      actorId: ACTOR,
    });
    expect(v.allowed).toBe(false);
    if (!v.allowed) expect(v.reason).toMatch(/archive/i);
  });

  it("gives a reason whenever it refuses", () => {
    // The dialog shows this text; a blank refusal would be a dead end.
    for (const t of [
      { targetId: ACTOR, targetRole: "member" },
      { targetId: 999, targetRole: "admin" },
      { targetId: ARCHIVE_USER_ID, targetRole: "member" },
    ]) {
      const v = canDeleteUser({ ...t, actorId: ACTOR });
      expect(v.allowed).toBe(false);
      if (!v.allowed) expect(v.reason.length).toBeGreaterThan(10);
    }
  });
});

describe("the table map", () => {
  it("covers every NO ACTION reference, so no delete can fail on a missed table", () => {
    // Measured against the live schema on 2026-08-06: 19 NO ACTION foreign keys
    // reference users.id. Miss one and the delete throws a foreign-key error
    // that the admin sees as an unexplained failure.
    expect(OWNED_TABLES).toHaveLength(19);
  });

  it("only moves the two columns that cannot be nulled", () => {
    // blog_posts.author_id and blog_comments.author_id are NOT NULL, so they
    // must be reassigned. Everything else is nullable and simply loses the
    // reference — a shiva notice does not stop being one because the account
    // that filed it is gone.
    const archived = OWNED_TABLES.filter((t) => t.onReassign === "archive");
    expect(archived.map((t) => `${t.table}.${t.column}`).sort()).toEqual([
      "blog_comments.author_id",
      "blog_posts.author_id",
    ]);
  });

  it("names every cascade nobody can prevent", () => {
    // NOT NULL *and* CASCADE: the database destroys these before any of our
    // code runs, in every mode. The UI has to say so out loud.
    //
    // user_shuls.user_id was missed first time round — it is the same shape as
    // the ATR comments but does not look like content, so it read as plumbing.
    // Production has exactly one such row, meaning a single delete removes all
    // shul-management data with no foreign-key error to stop it.
    expect(ALWAYS_DESTROYED.map((t) => t.table).sort()).toEqual([
      "ask_the_rabbi_comments",
      "user_shuls",
    ]);
  });

  it("lists no table twice under the same column", () => {
    const seen = new Set(OWNED_TABLES.map((t) => `${t.table}.${t.column}`));
    expect(seen.size).toBe(OWNED_TABLES.length);
  });
});

describe("content versus attribution", () => {
  /*
    The bug this pins: the first version put all 19 blocking tables in one list,
    and `purge` ran DELETE across the lot. That does not delete the user's
    content — it deletes the community's eruv history, other people's Ask the
    Rabbi questions, a shul's documents, and another user's shul-manager access.

    Caught in review before it could fire: every attribution row is currently
    held by the admin account, and deletion refuses admins. The guard that saved
    it was unrelated to the bug, which is exactly why it needed fixing rather
    than accepting.
  */

  const ATTRIBUTION_COLUMNS = [
    "ask_the_rabbi_submissions.reviewed_by",
    "community_newsletters.uploaded_by",
    "eruv_status.updated_by",
    "newsletters.created_by",
    "shul_documents.uploaded_by",
    "shul_registration_requests.reviewed_by",
    "user_shuls.assigned_by",
  ];

  it("keeps every acted-on column out of the content list", () => {
    const content = CONTENT_TABLES.map((t) => `${t.table}.${t.column}`);
    for (const col of ATTRIBUTION_COLUMNS) {
      expect(content, `${col} must never be purgeable`).not.toContain(col);
    }
  });

  it("classifies all seven as attribution", () => {
    const attribution = ATTRIBUTION_TABLES.map((t) => `${t.table}.${t.column}`).sort();
    expect(attribution).toEqual([...ATTRIBUTION_COLUMNS].sort());
  });

  it("never deletes attribution rows — they are only ever nulled", () => {
    // A NOT NULL attribution column would be unhandleable: it could be neither
    // nulled nor deleted. None exists today; this catches one being added.
    for (const t of ATTRIBUTION_TABLES) {
      expect(t.onReassign, `${t.table}.${t.column}`).toBe("null");
    }
  });

  it("still covers all 19 blocking references between the two lists", () => {
    // The split must not lose a table — a missed one means the delete throws a
    // foreign-key error the admin sees as an unexplained failure.
    expect(CONTENT_TABLES.length + ATTRIBUTION_TABLES.length).toBe(19);
    expect(OWNED_TABLES).toHaveLength(19);
  });

  it("puts the submitter and the reviewer of one table on opposite sides", () => {
    // ask_the_rabbi_submissions appears twice: user_id is the person's own
    // question, reviewed_by is someone else's. Purging must take the first and
    // never the second.
    expect(CONTENT_TABLES.map((t) => `${t.table}.${t.column}`))
      .toContain("ask_the_rabbi_submissions.user_id");
    expect(ATTRIBUTION_TABLES.map((t) => `${t.table}.${t.column}`))
      .toContain("ask_the_rabbi_submissions.reviewed_by");
  });
});
