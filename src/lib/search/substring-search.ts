import { and, or, ilike, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/** Guards against a pathological query building an enormous WHERE clause. */
const MAX_TERMS = 5;

/**
 * Splits a plain search box query into terms.
 *
 * Unlike `parseWords` in ./fuzzy-search.ts, single characters are kept. That
 * function feeds trigram similarity, where a one-character term is noise; this
 * one feeds exact substring matching, where dropping it would silently apply no
 * filter at all and look identical to the filter being broken.
 */
export function parseSearchTerms(search: string, maxTerms = MAX_TERMS): string[] {
  return search
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, maxTerms);
}

/**
 * Builds a case-insensitive substring condition over several columns.
 *
 * Every term must match *somewhere*: AND across terms, OR across columns. That
 * shape is what makes a query spanning two columns work — "danie makal" finds
 * Daniel Makalski because "danie" hits first_name and "makal" hits last_name.
 *
 * The tempting alternative, putting the whole query into each column, silently
 * fails for every multi-word search, because no single column contains all the
 * words. That was a real bug on /admin/users.
 *
 * Returns undefined when there is nothing to filter on, so the result can be
 * handed straight to `.where()`.
 */
export function buildSubstringCondition(
  columns: PgColumn[],
  search: string
): SQL | undefined {
  const terms = parseSearchTerms(search);
  if (terms.length === 0 || columns.length === 0) return undefined;

  const perTerm = terms.map((term) => {
    const like = `%${term}%`;
    return columns.length === 1
      ? ilike(columns[0], like)
      : or(...columns.map((c) => ilike(c, like)));
  });

  return and(...perTerm);
}
