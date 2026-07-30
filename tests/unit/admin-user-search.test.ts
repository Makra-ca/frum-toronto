import { describe, it, expect } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  parseUserSearchTerms,
  buildUserSearchCondition,
} from "../../src/lib/admin/user-search";

/**
 * Renders a condition to real SQL without needing a database connection.
 * (The drizzle condition object is circular, so it cannot be JSON-inspected.)
 */
const dialect = new PgDialect();
const toSql = (condition: ReturnType<typeof buildUserSearchCondition>) =>
  dialect.sqlToQuery(condition!).sql;

/**
 * Regression cover for the admin user search returning nothing for a full name.
 *
 * "danie makal" found no one even though Daniel Makalski exists, because the
 * whole query was matched inside each column and no single column holds both the
 * first and last name. The fix requires every term to match somewhere: AND
 * across terms, OR across columns.
 */
describe("parseUserSearchTerms", () => {
  it("splits a full name into separate terms", () => {
    expect(parseUserSearchTerms("danie makal")).toEqual(["danie", "makal"]);
  });

  it("collapses arbitrary whitespace", () => {
    expect(parseUserSearchTerms("  daniel   makalski  ")).toEqual(["daniel", "makalski"]);
    expect(parseUserSearchTerms("a\t\nb")).toEqual(["a", "b"]);
  });

  it("keeps single characters", () => {
    // parseWords in fuzzy-search.ts drops words shorter than 2, which is right
    // for trigram similarity. Here it would mean typing "d" silently filtered
    // nothing and appeared to list every user.
    expect(parseUserSearchTerms("d")).toEqual(["d"]);
  });

  it("returns an empty list for blank input", () => {
    expect(parseUserSearchTerms("")).toEqual([]);
    expect(parseUserSearchTerms("   ")).toEqual([]);
  });

  it("caps the number of terms so a pathological query cannot explode the query", () => {
    const terms = parseUserSearchTerms("a b c d e f g h i j");
    expect(terms).toHaveLength(5);
  });

  it("preserves the given order and case", () => {
    // Case is irrelevant downstream because the comparison is ILIKE, but the
    // parser should not quietly transform the input.
    expect(parseUserSearchTerms("Daniel Makalski")).toEqual(["Daniel", "Makalski"]);
  });
});

describe("buildUserSearchCondition", () => {
  it("returns undefined when there is nothing to filter on", () => {
    // Callers pass this straight to .where(), where undefined means "no filter".
    expect(buildUserSearchCondition("")).toBeUndefined();
    expect(buildUserSearchCondition("    ")).toBeUndefined();
  });

  it("builds a condition for a single term", () => {
    expect(buildUserSearchCondition("makalski")).toBeDefined();
  });

  it("builds a condition for a multi-term query", () => {
    expect(buildUserSearchCondition("danie makal")).toBeDefined();
  });

  it("searches first name, last name and email for a single term", () => {
    const sql = toSql(buildUserSearchCondition("makal"));
    expect((sql.match(/ilike/gi) ?? []).length).toBe(3);
    expect(sql).toContain("first_name");
    expect(sql).toContain("last_name");
    expect(sql).toContain("email");
  });

  it("ANDs the terms and ORs the columns, which is what fixes full-name search", () => {
    const sql = toSql(buildUserSearchCondition("danie makal"));

    // Three columns per term, two terms.
    expect((sql.match(/ilike/gi) ?? []).length).toBe(6);
    // The per-term groups are combined with and, the columns within each with or.
    expect(sql.toLowerCase()).toContain(" and ");
    expect(sql.toLowerCase()).toContain(" or ");
  });

  it("does not put the whole multi-word query into a single column", () => {
    // The original bug: one ilike per column containing "danie makal", which no
    // single column can ever satisfy.
    const { sql, params } = dialect.sqlToQuery(buildUserSearchCondition("danie makal")!);
    expect((sql.match(/ilike/gi) ?? []).length).toBeGreaterThan(3);
    expect(params).not.toContain("%danie makal%");
    expect(params).toContain("%danie%");
    expect(params).toContain("%makal%");
  });
});
