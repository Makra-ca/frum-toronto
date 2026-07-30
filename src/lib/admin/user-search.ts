import { and, or, ilike, type SQL } from "drizzle-orm";
import { users } from "@/lib/db/schema";

/** Guards against a pathological query building an enormous WHERE clause. */
const MAX_TERMS = 5;

/**
 * Splits an admin user-search box query into terms.
 *
 * Unlike `parseWords` in src/lib/search/fuzzy-search.ts, single characters are
 * kept: this is a plain substring lookup over ~3,150 rows rather than a trigram
 * similarity search, so typing "d" should narrow the list instead of being
 * silently dropped (which would show every user and look like the filter was
 * ignored).
 */
export function parseUserSearchTerms(search: string): string[] {
  return search
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, MAX_TERMS);
}

/**
 * Builds the WHERE condition for the admin user search.
 *
 * Every term must match *somewhere* (AND across terms, OR across columns) — the
 * same shape searchAskTheRabbi uses. This is what makes a query spanning two
 * columns work: "danie makal" matches Daniel Makalski because "danie" hits
 * first_name and "makal" hits last_name.
 *
 * The obvious-looking alternative — putting the whole query into each column —
 * silently fails for every full-name search, since no single column contains
 * both the first and last name.
 *
 * Returns undefined when there is nothing to filter on, so callers can pass the
 * result straight to `.where()`.
 */
export function buildUserSearchCondition(search: string): SQL | undefined {
  const terms = parseUserSearchTerms(search);
  if (terms.length === 0) return undefined;

  const perTerm = terms.map((term) => {
    const like = `%${term}%`;
    return or(
      ilike(users.firstName, like),
      ilike(users.lastName, like),
      ilike(users.email, like)
    );
  });

  return and(...perTerm);
}
