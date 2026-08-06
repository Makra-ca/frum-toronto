import { describe, it, expect } from "vitest";
import { canDeleteUser } from "@/lib/admin/user-deletion-guards";
import { ARCHIVE_USER_ID, OWNED_TABLES, ALWAYS_DESTROYED } from "@/lib/admin/user-deletion-tables";

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

  it("names the cascade nobody can prevent", () => {
    // NOT NULL *and* CASCADE: the database destroys these before any of our
    // code runs, in every mode. The UI has to say so out loud.
    expect(ALWAYS_DESTROYED.map((t) => t.table)).toEqual(["ask_the_rabbi_comments"]);
  });

  it("lists no table twice under the same column", () => {
    const seen = new Set(OWNED_TABLES.map((t) => `${t.table}.${t.column}`));
    expect(seen.size).toBe(OWNED_TABLES.length);
  });
});
