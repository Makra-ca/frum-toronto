/**
 * Applies a .sql file statement-by-statement to a Postgres database.
 *
 *   npx tsx scripts/apply-sql-file.ts migrations/<file>.sql            # DATABASE_URL (.env)
 *   npx tsx scripts/apply-sql-file.ts migrations/<file>.sql --test     # .env.test branch
 *
 * Only intended for additive DDL. It refuses to run a file containing
 * destructive keywords so a stray DROP can't be executed by accident.
 */
import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

const useTest = process.argv.includes("--test");
dotenv.config({ path: useTest ? ".env.test" : ".env" });

const file = process.argv[2];
if (!file) {
  console.error("Usage: npx tsx scripts/apply-sql-file.ts <file.sql> [--test]");
  process.exit(1);
}

const raw = fs.readFileSync(path.resolve(file), "utf8");

/**
 * Guard against the operations that destroy DATA.
 *
 * Note what this does NOT block: DROP CONSTRAINT, DROP INDEX, ALTER COLUMN.
 * Those are schema changes a migration legitimately makes — realigning a
 * foreign key, for instance — and blocking them would make this runner
 * useless for exactly the migrations that most need reviewing.
 *
 * The message says so, because "contains destructive SQL" reads as a much
 * broader promise than four DROP forms and it is easy to trust it too far.
 */
const FORBIDDEN = /\b(DROP\s+(TABLE|DATABASE|SCHEMA|COLUMN)|TRUNCATE|DELETE\s+FROM)\b/i;
if (FORBIDDEN.test(raw.replace(/--[^\n]*/g, ""))) {
  console.error(
    "REFUSED: file drops a table/database/schema/column, truncates, or deletes rows.\n" +
      "Apply it manually and deliberately. (This check does NOT cover\n" +
      "DROP CONSTRAINT, DROP INDEX or ALTER COLUMN — review those yourself.)"
  );
  process.exit(1);
}

/**
 * Strip line comments, then split on semicolons — but NOT semicolons inside a
 * dollar-quoted body.
 *
 * A naive `.split(";")` tears `DO $$ ... ; ... $$` apart and Postgres reports
 * "unterminated dollar-quoted string", which reads like a syntax error in the
 * migration rather than a bug in this runner. Any PL/pgSQL block hits it, so
 * conditional DDL (`IF NOT EXISTS ... THEN ALTER TABLE`) was effectively
 * unusable here.
 *
 * Postgres tags a dollar quote as `$tag$`, and the closing delimiter must match
 * the opening one exactly, so tracking the active tag is enough.
 */
function splitStatements(sql: string): string[] {
  const withoutComments = sql
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");

  const out: string[] = [];
  let current = "";
  let dollarTag: string | null = null;

  for (let i = 0; i < withoutComments.length; i++) {
    if (dollarTag) {
      if (withoutComments.startsWith(dollarTag, i)) {
        current += dollarTag;
        i += dollarTag.length - 1;
        dollarTag = null;
        continue;
      }
      current += withoutComments[i];
      continue;
    }

    const opening = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(
      withoutComments.slice(i)
    );
    if (opening) {
      dollarTag = opening[0];
      current += dollarTag;
      i += dollarTag.length - 1;
      continue;
    }

    if (withoutComments[i] === ";") {
      out.push(current);
      current = "";
      continue;
    }

    current += withoutComments[i];
  }
  out.push(current);

  return out.map((s) => s.trim()).filter(Boolean);
}

const statements = splitStatements(raw);

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error(`DATABASE_URL missing from ${useTest ? ".env.test" : ".env"}`);

  const host = new URL(url).host;
  console.log(`Target: ${useTest ? "TEST BRANCH" : "PRIMARY"} (${host})`);
  console.log(`File:   ${file}`);
  console.log(`Statements: ${statements.length}\n`);

  const sql = neon(url);

  for (const [i, stmt] of statements.entries()) {
    const label = stmt.replace(/\s+/g, " ").slice(0, 90);
    try {
      await sql.query(stmt);
      console.log(`  [${i + 1}/${statements.length}] ok   ${label}`);
    } catch (e) {
      console.error(`  [${i + 1}/${statements.length}] FAIL ${label}`);
      throw e;
    }
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error("\nERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
