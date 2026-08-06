import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { OWNED_TABLES, ALWAYS_DESTROYED, ARCHIVE_USER_ID } from "@/lib/admin/user-deletion-tables";

/**
 * The set of accounts safe to clear in bulk.
 *
 * ## Why "unverified" alone is not the answer
 *
 * The obvious query is "delete the unverified accounts". It is also the one that
 * would have destroyed the client's own work:
 *
 *   **`rochel@frumtoronto.com` (id 9) is unverified and owns 1,395 blog posts.**
 *
 * She signs in as `admin@frumtoronto.com`; id 9 is the import-created account
 * that owns her articles. A sweep of "all unverified users" deletes her
 * authorship account and every article attributed to her. 86 accounts are
 * unverified in total; only some of those are bots.
 *
 * ## The three conditions, and what each one is for
 *
 * - **unverified** — every bot signup is; a real member who clicked the link is not.
 * - **created in the last 30 days** — the bot wave started around 2026-07-31.
 *   This is what excludes id 9 and the other long-standing unverified accounts,
 *   and it is why the window is deliberately narrow rather than generous.
 * - **owns nothing, in any table** — the actual safety property. An account
 *   that has never posted anything cannot be a contributor, whatever else is
 *   true of it. Checked against all 19 blocking tables PLUS Ask the Rabbi
 *   comments, which the database would destroy silently.
 *
 * Admins and the Archive account are excluded outright. Both are already
 * refused by `canDeleteUser`, so this is belt and braces — but a bulk list an
 * admin is about to tick every box on should not contain an account the API
 * will then refuse.
 */

export interface SpamCandidate {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date | null;
}

/** Days back the cohort reaches. Narrow on purpose — see above. */
export const SPAM_COHORT_DAYS = 30;

function ownsNothingClause(): string {
  // Identifiers come from module constants, never request input.
  return [...OWNED_TABLES, ...ALWAYS_DESTROYED]
    .map((t) => `NOT EXISTS (SELECT 1 FROM ${t.table} WHERE ${t.table}.${t.column} = u.id)`)
    .join(" AND ");
}

export async function findSpamCandidates(limit = 500): Promise<SpamCandidate[]> {
  const result = await db.execute(
    sql`
      SELECT u.id, u.email, u.first_name, u.last_name, u.created_at
      FROM users u
      WHERE u.email_verified IS NULL
        AND u.created_at > now() - ${sql.raw(`interval '${SPAM_COHORT_DAYS} days'`)}
        AND u.role <> 'admin'
        AND u.id <> ${ARCHIVE_USER_ID}
        AND ${sql.raw(ownsNothingClause())}
      ORDER BY u.created_at DESC
      LIMIT ${limit}
    `
  );

  const rows =
    (result as unknown as { rows?: RawRow[] }).rows ?? (result as unknown as RawRow[]);

  return (rows ?? []).map((r) => ({
    id: Number(r.id),
    email: String(r.email),
    firstName: r.first_name ?? null,
    lastName: r.last_name ?? null,
    createdAt: r.created_at ? new Date(r.created_at) : null,
  }));
}

interface RawRow {
  id: number | string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string | null;
}
