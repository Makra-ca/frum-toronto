import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Session } from "next-auth";

/**
 * True for an admin, or for any user holding the canManageAskTheRabbi flag.
 *
 * Takes the whole Session deliberately — every call site already has one, and
 * matching the signature of the isAuthorized() this replaces means no call site
 * can be migrated wrongly. A narrower `{ id?, role? }` parameter would still
 * accept a whole Session (every property optional) and return false for
 * everyone, with no type error and no failing test.
 *
 * Reads the database on purpose. `session.user.canManageAskTheRabbi` DOES exist
 * (auth.ts:57 puts it in the token, :81 copies it onto the session) and reading
 * it would save a query — but a token minted before the flag was granted still
 * carries the stale value, so a newly permitted user would keep being refused
 * until their session refreshed. Do not "optimise" this into a token read;
 * tests/atr-submissions-permissions.test.ts pins both directions.
 */
export async function canManageAtr(
  session: Session | null | undefined
): Promise<boolean> {
  if (!session?.user?.id) return false;
  if (session.user.role === "admin") return true;

  const [dbUser] = await db
    .select({ canManageAskTheRabbi: users.canManageAskTheRabbi })
    .from(users)
    .where(eq(users.id, parseInt(session.user.id)))
    .limit(1);

  return dbUser?.canManageAskTheRabbi === true;
}
