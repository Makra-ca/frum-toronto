import { type SQL } from "drizzle-orm";
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
