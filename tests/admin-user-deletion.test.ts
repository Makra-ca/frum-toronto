import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createTestUser, cleanupTestUsers } from "./utils/test-db";

/**
 * DELETE /api/admin/users/[id].
 *
 * Users could not be deleted at all — the route exported PATCH only, and the
 * only control was the Active toggle, which blocks sign-in but leaves the row
 * in a list 3,200 rows long.
 *
 * A plain DELETE would not have worked either: 19 foreign keys are NO ACTION,
 * so the database refuses to orphan anyone's content. Hence the dry run, and
 * the two modes.
 */

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: String(adminId), role: "admin", email: "test-del-admin@frumtoronto.test" },
  })),
}));

const { DELETE } = await import("@/app/api/admin/users/[id]/route");
const { db } = await import("@/lib/db");
const { users, blogPosts, blogComments, simchas, auditLog, shuls, userShuls, eruvStatus } =
  await import("@/lib/db/schema");
const { ARCHIVE_USER_ID } = await import("@/lib/admin/user-deletion-tables");

const stamp = Date.now();

/**
 * `eruv_status.status_date` is UNIQUE, so a hardcoded date makes this file
 * runnable exactly once per day: an interrupted run leaves the row behind and
 * every later run collides on it. Deriving far-future dates from the run stamp
 * gives each run its own, and afterAll sweeps them regardless of where a test
 * stopped.
 */
const eruvDates: string[] = [];
function nextEruvDate() {
  // Well past any real eruv record, and unique per run + call.
  const d = new Date(Date.UTC(2100, 0, 1));
  d.setUTCDate(d.getUTCDate() + (stamp % 10000) * 2 + eruvDates.length);
  const value = d.toISOString().slice(0, 10);
  eruvDates.push(value);
  return value;
}
let adminId = 0;
let cleanUserId = 0;
let authorId = 0;
let purgeUserId = 0;
const createdPostIds: number[] = [];
const createdSimchaIds: number[] = [];

const call = (id: number, mode?: string) =>
  DELETE(
    new Request(
      `http://localhost/api/admin/users/${id}${mode ? `?mode=${mode}` : ""}`,
      { method: "DELETE" }
    ) as never,
    { params: Promise.resolve({ id: String(id) }) } as never
  );

beforeAll(async () => {
  adminId = (
    await createTestUser({
      email: `test-del-admin@frumtoronto.test`,
      role: "admin",
    })
  ).id;
  cleanUserId = (
    await createTestUser({ email: `test-del-clean-${stamp}@frumtoronto.test` })
  ).id;
  authorId = (
    await createTestUser({ email: `test-del-author-${stamp}@frumtoronto.test` })
  ).id;
  purgeUserId = (
    await createTestUser({ email: `test-del-purge-${stamp}@frumtoronto.test` })
  ).id;

  const [post] = await db
    .insert(blogPosts)
    .values({
      authorId,
      title: `[TEST] Keepable Post ${stamp}`,
      slug: `test-keepable-${stamp}`,
      content: "<p>[TEST]</p>",
      approvalStatus: "approved",
      isActive: true,
    })
    .returning({ id: blogPosts.id });
  createdPostIds.push(post.id);

  const [simcha] = await db
    .insert(simchas)
    .values({
      userId: authorId,
      familyName: `[TEST] Family ${stamp}`,
      announcement: "[TEST]",
      approvalStatus: "approved",
    })
    .returning({ id: simchas.id });
  createdSimchaIds.push(simcha.id);

  const [purgePost] = await db
    .insert(blogPosts)
    .values({
      authorId: purgeUserId,
      title: `[TEST] Purgeable Post ${stamp}`,
      slug: `test-purgeable-${stamp}`,
      content: "<p>[TEST]</p>",
      approvalStatus: "approved",
      isActive: true,
    })
    .returning({ id: blogPosts.id });
  createdPostIds.push(purgePost.id);
});

afterAll(async () => {
  // Reassigned posts end up on the Archive account, so they are cleaned by id
  // rather than by author.
  if (createdPostIds.length) {
    await db.delete(blogPosts).where(inArray(blogPosts.id, createdPostIds));
  }
  if (createdSimchaIds.length) {
    await db.delete(simchas).where(inArray(simchas.id, createdSimchaIds));
  }
  if (eruvDates.length) {
    await db.delete(eruvStatus).where(inArray(eruvStatus.statusDate, eruvDates));
  }
  await db.delete(auditLog).where(eq(auditLog.actorId, adminId));
  await cleanupTestUsers();
});

describe("the dry run", () => {
  it("reports an account that owns nothing as ready", async () => {
    const res = await call(cleanUserId);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.totalOwned).toBe(0);
    expect(body.owned).toEqual([]);

    // And it wrote nothing.
    const [still] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, cleanUserId));
    expect(still).toBeDefined();
  });

  it("refuses an account with content, and says what it owns", async () => {
    const res = await call(authorId);
    expect(res.status).toBe(409);

    const body = await res.json();
    expect(body.requiresMode).toBe(true);
    expect(body.totalOwned).toBe(2);

    const labels = body.owned.map((o: { label: string }) => o.label).sort();
    expect(labels).toEqual(["Blog posts", "Simchas"]);

    const [still] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, authorId));
    expect(still).toBeDefined();
  });
});

describe("refusals", () => {
  it("will not delete an admin", async () => {
    const other = await createTestUser({
      email: `test-del-otheradmin-${stamp}@frumtoronto.test`,
      role: "admin",
    });

    const res = await call(other.id);
    expect(res.status).toBe(403);

    const [still] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, other.id));
    expect(still).toBeDefined();

    await db.delete(users).where(eq(users.id, other.id));
  });

  it("will not delete the caller's own account", async () => {
    const res = await call(adminId);
    expect(res.status).toBe(403);
  });

  it("will not delete the Archive account", async () => {
    // Reassignment moves content TO it, and it owns 283 imported posts.
    const res = await call(ARCHIVE_USER_ID);
    expect(res.status).toBe(403);

    const [still] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, ARCHIVE_USER_ID));
    expect(still).toBeDefined();
  });

  it("records a refusal in the audit log", async () => {
    // "Who tried to delete whom" is worth as much as "who did".
    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, ARCHIVE_USER_ID));

    const refusal = rows.find(
      (r) => (r.changes as Record<string, unknown> | null)?.refused
    );
    expect(refusal).toBeDefined();
    expect(refusal!.action).toBe("DELETE");
  });
});

describe("mode=reassign", () => {
  it("keeps the posts, moves them to the Archive account, and clears the rest", async () => {
    const res = await call(authorId, "reassign");
    expect(res.status).toBe(200);

    // The account is gone.
    const [gone] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, authorId));
    expect(gone).toBeUndefined();

    // The post survives, on the Archive account. author_id is NOT NULL, so
    // this is the only way it could have survived at all.
    const [post] = await db
      .select({ authorId: blogPosts.authorId, isActive: blogPosts.isActive })
      .from(blogPosts)
      .where(eq(blogPosts.id, createdPostIds[0]));
    expect(post.authorId).toBe(ARCHIVE_USER_ID);
    expect(post.isActive).toBe(true);

    // The simcha survives too, with the owner reference cleared — it is
    // nullable, so there is nothing to reassign.
    const [simcha] = await db
      .select({ userId: simchas.userId })
      .from(simchas)
      .where(eq(simchas.id, createdSimchaIds[0]));
    expect(simcha.userId).toBeNull();
  });

  it("records what was moved, before the move", async () => {
    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, authorId));

    const entry = rows.find(
      (r) => (r.changes as Record<string, unknown> | null)?.mode
    );
    expect(entry).toBeDefined();
    // Afterwards there is nothing left to count, so the inventory captured at
    // delete time is the only record of what went.
    expect(entry!.changes).toMatchObject({ mode: { after: "reassign" } });
  });
});

describe("mode=purge and attribution", () => {
  it("does NOT delete records the user merely acted on", async () => {
    /*
      The bug: purge originally ran DELETE across all 19 blocking tables,
      including the seven that record an ACTION on someone else's record. That
      would delete the community's eruv history, and — via user_shuls.assigned_by
      — another user's shul-manager access.

      This builds exactly that: an assigner who is not the manager, then purges
      the assigner and checks the manager still has their shul.
    */
    const assigner = await createTestUser({
      email: `test-del-assigner-${stamp}@frumtoronto.test`,
    });
    const manager = await createTestUser({
      email: `test-del-manager-${stamp}@frumtoronto.test`,
      role: "shul",
    });

    const [shul] = await db
      .insert(shuls)
      .values({ name: `[TEST] Attribution Shul ${stamp}`, slug: `test-attr-${stamp}` })
      .returning({ id: shuls.id });

    await db.insert(userShuls).values({
      userId: manager.id,
      shulId: shul.id,
      assignedBy: assigner.id,
    });

    const [eruv] = await db
      .insert(eruvStatus)
      .values({ statusDate: nextEruvDate(), isUp: true, updatedBy: assigner.id })
      .returning({ id: eruvStatus.id });

    const res = await call(assigner.id, "purge");
    expect(res.status).toBe(200);

    // The assigner is gone...
    const [gone] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, assigner.id));
    expect(gone).toBeUndefined();

    // ...but the manager still manages their shul, with the reference cleared.
    const [assignment] = await db
      .select({ userId: userShuls.userId, assignedBy: userShuls.assignedBy })
      .from(userShuls)
      .where(eq(userShuls.shulId, shul.id));
    expect(assignment).toBeDefined();
    expect(assignment.userId).toBe(manager.id);
    expect(assignment.assignedBy).toBeNull();

    // ...and the community's eruv record survives.
    const [eruvRow] = await db
      .select({ id: eruvStatus.id, updatedBy: eruvStatus.updatedBy })
      .from(eruvStatus)
      .where(eq(eruvStatus.id, eruv.id));
    expect(eruvRow).toBeDefined();
    expect(eruvRow.updatedBy).toBeNull();

    await db.delete(eruvStatus).where(eq(eruvStatus.id, eruv.id));
    await db.delete(userShuls).where(eq(userShuls.shulId, shul.id));
    await db.delete(shuls).where(eq(shuls.id, shul.id));
    await db.delete(users).where(eq(users.id, manager.id));
  });

  it("reports acted-on records separately from authored ones", async () => {
    // The dialog relies on this split: content is a decision, attribution is
    // an FYI. Merging them invites an admin to destroy community records.
    const actor = await createTestUser({
      email: `test-del-actor-${stamp}@frumtoronto.test`,
    });
    const [eruv] = await db
      .insert(eruvStatus)
      .values({ statusDate: nextEruvDate(), isUp: false, updatedBy: actor.id })
      .returning({ id: eruvStatus.id });

    const res = await call(actor.id);
    const body = await res.json();

    // Attribution alone must NOT force the mode choice.
    expect(res.status).toBe(200);
    expect(body.totalOwned).toBe(0);
    expect(body.owned).toEqual([]);
    expect(body.attributed.map((a: { label: string }) => a.label)).toContain("Eruv updates");

    await db.delete(eruvStatus).where(eq(eruvStatus.id, eruv.id));
    await db.delete(users).where(eq(users.id, actor.id));
  });

  it("removes the account and its content", async () => {
    const res = await call(purgeUserId, "purge");
    expect(res.status).toBe(200);

    const [gone] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, purgeUserId));
    expect(gone).toBeUndefined();

    const [post] = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(eq(blogPosts.id, createdPostIds[1]));
    expect(post).toBeUndefined();
  });
});

describe("a clean account", () => {
  it("deletes without needing a mode decision", async () => {
    const res = await call(cleanUserId, "purge");
    expect(res.status).toBe(200);

    const [gone] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, cleanUserId));
    expect(gone).toBeUndefined();
  });
});

describe("what the database destroys regardless of mode", () => {
  it("counts other people's comments on this author's posts", async () => {
    /*
      blog_comments.post_id is CASCADE, so purging an author deletes their
      posts and every comment on those posts — by ANYONE. The inventory counted
      blog_comments.author_id (comments they WROTE), a different set entirely,
      so the dialog under-reported what an irreversible action destroys.
    */
    const author = await createTestUser({
      email: `test-casc-author-${stamp}@frumtoronto.test`,
    });
    const commenter = await createTestUser({
      email: `test-casc-commenter-${stamp}@frumtoronto.test`,
    });

    const [post] = await db
      .insert(blogPosts)
      .values({
        authorId: author.id,
        title: `[TEST] Cascade Post ${stamp}`,
        slug: `test-cascade-${stamp}`,
        content: "<p>[TEST]</p>",
        approvalStatus: "approved",
        isActive: true,
      })
      .returning({ id: blogPosts.id });

    const [comment] = await db
      .insert(blogComments)
      .values({ postId: post.id, authorId: commenter.id, content: "[TEST] someone else's comment" })
      .returning({ id: blogComments.id });

    const res = await call(author.id);
    expect(res.status).toBe(409);
    const body = await res.json();

    const labels = body.destroyed.map((d: { label: string }) => d.label).join(" | ");
    expect(labels).toMatch(/comments by others/i);

    // Not counted as the author's own content — they did not write it.
    expect(body.owned.map((o: { label: string }) => o.label)).not.toContain("Blog comments");

    await db.delete(blogComments).where(eq(blogComments.id, comment.id));
    await db.delete(blogPosts).where(eq(blogPosts.id, post.id));
    await db.delete(users).where(inArray(users.id, [author.id, commenter.id]));
  });

  it("warns that deleting a shul manager removes their shul access", async () => {
    // user_shuls.user_id is CASCADE + NOT NULL — same shape as the Ask the
    // Rabbi comments, and easy to miss because it does not look like content.
    // Production has exactly one such row, so one delete removes all of it.
    const manager = await createTestUser({
      email: `test-warn-manager-${stamp}@frumtoronto.test`,
      role: "shul",
    });
    const [shul] = await db
      .insert(shuls)
      .values({ name: `[TEST] Warn Shul ${stamp}`, slug: `test-warn-${stamp}` })
      .returning({ id: shuls.id });
    await db.insert(userShuls).values({ userId: manager.id, shulId: shul.id });

    const res = await call(manager.id);
    const body = await res.json();

    const labels = body.destroyed.map((d: { label: string }) => d.label).join(" | ");
    expect(labels).toMatch(/shul manager/i);

    await db.delete(userShuls).where(eq(userShuls.shulId, shul.id));
    await db.delete(shuls).where(eq(shuls.id, shul.id));
    await db.delete(users).where(eq(users.id, manager.id));
  });
});
