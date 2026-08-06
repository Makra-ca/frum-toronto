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

/**
 * Counts everything the account owns. Read-only; writes nothing.
 *
 * ONE query, not one per table. The first version issued a `count(*)` per
 * table — 21 sequential round trips, measured at **1.28s for a single user**,
 * which made a 20-row bulk delete sit on "Checking what these accounts own…"
 * for about 25 seconds with nothing moving. No test caught that: tests assert
 * results, not latency. It showed up the first time a human clicked the button.
 *
 * UNION ALL keeps it to a single round trip. Rows counting zero are dropped in
 * SQL rather than in JS, so the payload stays small.
 */
export async function inventoryUserContent(userId: number): Promise<UserInventory> {
  const parts: string[] = [];

  const push = (bucket: string, table: string, column: string, label: string) => {
    // Identifiers are module constants, never request input — see the note on
    // OWNED_TABLES. The user id is parameterised.
    parts.push(
      `SELECT '${bucket}' AS bucket, ${escapeLiteral(label)} AS label, count(*)::int AS n
       FROM ${table} WHERE ${column} = $1`
    );
  };

  for (const t of CONTENT_TABLES) push("owned", t.table, t.column, t.label);
  for (const t of ATTRIBUTION_TABLES) push("attributed", t.table, t.column, t.label);
  for (const t of ALWAYS_DESTROYED) push("destroyed", t.table, t.column, t.label);

  // Comments by OTHER people on this author's posts. Invisible to any
  // single-column count: they belong to other authors and are only reachable
  // through the post, via blog_comments.post_id CASCADE.
  parts.push(
    `SELECT 'destroyed' AS bucket,
            'Comments by others on their posts (only if you delete everything)' AS label,
            count(*)::int AS n
     FROM blog_comments c JOIN blog_posts p ON p.id = c.post_id
     WHERE p.author_id = $1 AND c.author_id <> $1`
  );

  const result = await db.execute(
    sql.raw(
      `SELECT bucket, label, sum(n)::int AS n FROM (
         ${parts.join(" UNION ALL ")}
       ) x GROUP BY bucket, label HAVING sum(n) > 0 ORDER BY sum(n) DESC`
        .replace(/\$1/g, String(userId))
    )
  );

  const rows =
    (result as unknown as { rows?: InventoryRow[] }).rows ??
    (result as unknown as InventoryRow[]);

  const owned: ContentCount[] = [];
  const attributed: ContentCount[] = [];
  const destroyed: ContentCount[] = [];

  for (const r of rows ?? []) {
    const entry = { label: String(r.label), count: Number(r.n) };
    if (r.bucket === "owned") owned.push(entry);
    else if (r.bucket === "attributed") attributed.push(entry);
    else destroyed.push(entry);
  }

  return {
    owned,
    attributed,
    destroyed,
    // Content only. This drives the "must choose a mode" 409, and attribution
    // needs no decision from anyone.
    totalOwned: owned.reduce((sum, r) => sum + r.count, 0),
  };
}

interface InventoryRow {
  bucket: string;
  label: string;
  n: number;
}

/** Single-quote a SQL string literal. Labels are ours, but never interpolate raw. */
function escapeLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
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
