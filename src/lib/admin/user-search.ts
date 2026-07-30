import { eq, sql, type SQL } from "drizzle-orm";
import { users } from "@/lib/db/schema";
import { buildSubstringCondition, parseSearchTerms } from "@/lib/search/substring-search";

/** Re-exported so existing callers and tests keep a stable entry point. */
export const parseUserSearchTerms = (search: string): string[] => parseSearchTerms(search);

/**
 * WHERE condition for the admin user search box.
 *
 * Matches every term against first name, last name or email, so a full-name
 * query works even though no single column holds both names. See
 * buildSubstringCondition for why that shape matters.
 */
export function buildUserSearchCondition(search: string): SQL | undefined {
  return buildSubstringCondition(
    [users.firstName, users.lastName, users.email],
    search
  );
}

export type UserStatusFilter = "all" | "active" | "blocked";

export function parseUserStatus(raw: string | undefined): UserStatusFilter {
  return raw === "active" || raw === "blocked" ? raw : "all";
}

/**
 * WHERE condition for the account-status filter.
 *
 * `is_active = false` is this project's ban flag — it blocks both password and
 * Google sign-in (see the isActive checks in src/lib/auth/auth.ts) — so the UI
 * calls it "Blocked" rather than "Inactive", which reads as merely dormant.
 *
 * The NULL case matters: `is_active` is nullable and the UI treats NULL as
 * active (`user.isActive ?? true`), and login only rejects on a falsy value, so
 * a NULL row can still sign in. "Blocked" therefore means explicitly false, and
 * "Active" means true-or-NULL.
 */
export function buildUserStatusCondition(status: UserStatusFilter): SQL | undefined {
  if (status === "blocked") return eq(users.isActive, false);
  if (status === "active") return sql`${users.isActive} IS NOT FALSE`;
  return undefined;
}
