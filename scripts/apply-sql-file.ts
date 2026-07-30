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

// Guard: this runner is for additive DDL only.
const FORBIDDEN = /\b(DROP\s+(TABLE|DATABASE|SCHEMA|COLUMN)|TRUNCATE|DELETE\s+FROM)\b/i;
if (FORBIDDEN.test(raw.replace(/--[^\n]*/g, ""))) {
  console.error("REFUSED: file contains destructive SQL. Apply it manually and deliberately.");
  process.exit(1);
}

// Strip line comments, then split on semicolons.
const statements = raw
  .split("\n")
  .map((l) => l.replace(/--.*$/, ""))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

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
