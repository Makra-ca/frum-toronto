import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  ARCHIVE_USER_ID,
  CONTENT_TABLES,
  ATTRIBUTION_TABLES,
  ALWAYS_DESTROYED,
} from "@/lib/admin/user-deletion-tables";

/**
 * Deleting a user account.
 *
 * ## Why this is not a one-line DELETE
 *
 * 31 foreign keys reference `users.id`, in three groups, and the group decides
 * what a delete actually does:
 *
 * - **8 CASCADE** — removed silently with the user (sessions, accounts,
 *   notifications, subscriber row, …). Mostly harmless plumbing, with ONE
 *   exception noted below.
 * - **4 SET NULL** — the row survives with the reference cleared (`audit_log`,
 *   `homepage_ads.submitted_by`, `page_views`, `search_queries`). Deliberate:
 *   the audit trail must outlive the actor.
 * - **19 NO ACTION** — the delete FAILS with a foreign-key error. This is the
 *   database refusing to orphan someone's content, and it is why a naive delete
 *   button would just show an error toast on any real member.
 *
 * ## The one that has no safe answer
 *
 * `ask_the_rabbi_comments.author_id` is NOT NULL **and** CASCADE. There is no
 * mode in which those comments survive — the database destroys them before any
 * code of ours runs, and no foreign-key error stops it. The UI has to say so out
 * loud rather than let an admin discover it afterwards.
 *
 * ## No transaction
 *
 * `neon-http` does not support them. So reassign-then-delete is two round trips,
 * and the ORDER is chosen for what a half-failure leaves behind:
 *
 *   reassign first → if the delete then fails, content is safely on the Archive
 *   account and the user still exists. Visible, and recoverable.
 *
 *   delete first → impossible anyway (the foreign keys refuse), but the mirror
 *   case — purge content, then fail to delete the user — destroys content and
 *   leaves the account. Strictly worse.
 */

// The table map lives in a DB-free module so it can be tested without a
// database — importing `@/lib/db` there would break the unit project, which
// runs without DATABASE_URL. Re-exported so callers have one import site.
export {
  ARCHIVE_USER_ID,
  OWNED_TABLES,
  CONTENT_TABLES,
  ATTRIBUTION_TABLES,
  ALWAYS_DESTROYED,
  type ReassignAction,
} from "@/lib/admin/user-deletion-tables";

export interface ContentCount {
  label: string;
  count: number;
}

export interface UserInventory {
  /** Things they authored. These are what the two modes actually decide about. */
  owned: ContentCount[];
  /**
   * Things they DID to records that are not theirs — reviewed, uploaded,
   * assigned. Reported separately because they are never deleted, only
   * detached, so listing them alongside content would imply a choice that does
   * not exist and invite an admin to destroy community records.
   */
  attributed: ContentCount[];
  /** Content the database will destroy whatever mode is chosen. */
  destroyed: ContentCount[];
  totalOwned: number;
}

/** Counts everything the account owns. Read-only; writes nothing. */
export async function inventoryUserContent(userId: number): Promise<UserInventory> {
  const owned: ContentCount[] = [];
  const attributed: ContentCount[] = [];
  const destroyed: ContentCount[] = [];

  for (const t of CONTENT_TABLES) {
    const n = await countRows(t.table, t.column, userId);
    if (n > 0) owned.push({ label: t.label, count: n });
  }

  for (const t of ATTRIBUTION_TABLES) {
    const n = await countRows(t.table, t.column, userId);
    if (n > 0) attributed.push({ label: t.label, count: n });
  }

  for (const t of ALWAYS_DESTROYED) {
    const n = await countRows(t.table, t.column, userId);
    if (n > 0) destroyed.push({ label: t.label, count: n });
  }

  /*
    Comments left by OTHER PEOPLE on this person's blog posts.

    blog_comments.post_id is CASCADE, so deleting a post takes every comment on
    it — whoever wrote them. The loop above counts blog_comments.author_id, i.e.
    comments this person WROTE, which is a different set entirely. Without this
    the dialog under-reports what purge destroys, on an irreversible action.

    Only purge deletes the posts; reassign moves them to the Archive account and
    the comments ride along. But the dry run does not know the mode yet, so it
    reports the worst case and the wording says "if you delete everything".
  */
  const cascadedComments = await countCascadedPostComments(userId);
  if (cascadedComments > 0) {
    destroyed.push({
      label: "Comments by others on their posts (only if you delete everything)",
      count: cascadedComments,
    });
  }

  // Labels are not unique — ask_the_rabbi_submissions appears twice, as the
  // submitter and as the reviewer — so they are merged rather than shown as two
  // confusing rows with the same name.
  const merged = new Map<string, number>();
  for (const row of owned) merged.set(row.label, (merged.get(row.label) ?? 0) + row.count);

  const mergedOwned = [...merged.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return {
    owned: mergedOwned,
    attributed,
    destroyed,
    // Deliberately counts CONTENT only. This drives the "must choose a mode"
    // 409, and attribution needs no decision from anyone.
    totalOwned: mergedOwned.reduce((sum, r) => sum + r.count, 0),
  };
}

/**
 * Comments written by anyone OTHER than this user, on posts this user authored.
 *
 * These vanish through `blog_comments.post_id` CASCADE when a purge deletes the
 * posts. Counted separately because no single-column count can see them: they
 * belong to other authors and are only reachable through the post.
 */
async function countCascadedPostComments(userId: number): Promise<number> {
  const result = await db.execute(
    sql`SELECT count(*)::int AS n
        FROM blog_comments c
        JOIN blog_posts p ON p.id = c.post_id
        WHERE p.author_id = ${userId} AND c.author_id <> ${userId}`
  );
  const rows =
    (result as unknown as { rows?: Array<{ n: number }> }).rows ??
    (result as unknown as Array<{ n: number }>);
  return Number(rows?.[0]?.n ?? 0);
}

async function countRows(table: string, column: string, userId: number): Promise<number> {
  // sql.raw on the identifiers only. They come from OWNED_TABLES /
  // ALWAYS_DESTROYED above — module constants, never request input. The VALUE is
  // still parameterised.
  const result = await db.execute(
    sql`SELECT count(*)::int AS n FROM ${sql.raw(table)} WHERE ${sql.raw(column)} = ${userId}`
  );
  const rows = (result as unknown as { rows?: Array<{ n: number }> }).rows ?? (result as unknown as Array<{ n: number }>);
  return Number(rows?.[0]?.n ?? 0);
}

export type DeleteMode = "reassign" | "purge";

/**
 * Moves or removes everything blocking the delete, then deletes the user.
 *
 * Returns the inventory as it stood beforehand, so the caller can record in the
 * audit log what was actually destroyed — afterwards there is nothing left to
 * count.
 */
export async function deleteUserWithContent(
  userId: number,
  mode: DeleteMode
): Promise<UserInventory> {
  const inventory = await inventoryUserContent(userId);

  // ATTRIBUTION FIRST, and never deleted — in either mode. These rows are not
  // the person's content; they record that the person acted on someone else's.
  // Deleting them removes the community's eruv history, other people's Ask the
  // Rabbi questions, a shul's documents, and another user's shul-manager
  // access. See ATTRIBUTION_TABLES for why this is separate from content.
  for (const t of ATTRIBUTION_TABLES) {
    await db.execute(
      sql`UPDATE ${sql.raw(t.table)} SET ${sql.raw(t.column)} = NULL WHERE ${sql.raw(t.column)} = ${userId}`
    );
  }

  for (const t of CONTENT_TABLES) {
    if (mode === "purge") {
      await db.execute(
        sql`DELETE FROM ${sql.raw(t.table)} WHERE ${sql.raw(t.column)} = ${userId}`
      );
      continue;
    }

    if (t.onReassign === "archive") {
      // NOT NULL, so it cannot be cleared — it moves to the Archive account.
      await db.execute(
        sql`UPDATE ${sql.raw(t.table)} SET ${sql.raw(t.column)} = ${ARCHIVE_USER_ID} WHERE ${sql.raw(t.column)} = ${userId}`
      );
    } else {
      await db.execute(
        sql`UPDATE ${sql.raw(t.table)} SET ${sql.raw(t.column)} = NULL WHERE ${sql.raw(t.column)} = ${userId}`
      );
    }
  }

  // Last, deliberately. If this fails the content is already safe on the
  // Archive account (or gone, in purge mode, which the admin asked for) and the
  // account still exists — a visible, recoverable half-state rather than a
  // silent one.
  await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);

  return inventory;
}
