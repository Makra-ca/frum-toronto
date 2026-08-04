import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * The authorization claims carried on a session token.
 *
 * These decide whether someone reaches /admin and passes the ~101 admin API
 * route checks, so they may only ever come from the database.
 */
export interface UserClaims {
  role: string;
  isTrusted: boolean;
  canManageAskTheRabbi: boolean;
}

export const DEFAULT_CLAIMS: UserClaims = {
  role: "member",
  isTrusted: false,
  canManageAskTheRabbi: false,
};

/**
 * Read a user's authorization claims from the database.
 *
 * Returns null when the user cannot be found, so the caller can decide between
 * keeping existing claims and falling back to DEFAULT_CLAIMS — never silently
 * granting anything.
 */
export async function loadUserClaims(
  by: { id: string | number } | { email: string }
): Promise<UserClaims | null> {
  const where =
    "email" in by
      ? eq(users.email, by.email.toLowerCase())
      : eq(users.id, typeof by.id === "string" ? parseInt(by.id) : by.id);

  const [row] = await db
    .select({
      role: users.role,
      isTrusted: users.isTrusted,
      canManageAskTheRabbi: users.canManageAskTheRabbi,
    })
    .from(users)
    .where(where)
    .limit(1);

  if (!row) return null;

  return {
    role: row.role,
    isTrusted: row.isTrusted ?? false,
    canManageAskTheRabbi: row.canManageAskTheRabbi ?? false,
  };
}
