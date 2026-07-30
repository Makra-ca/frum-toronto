/**
 * Runs the admin user search through the real drizzle condition against the live
 * database, because the page itself sits behind admin auth and cannot be curl'd.
 *
 *   npx tsx scripts/legacy-import/verify-user-search.ts
 *
 * The reported bug: searching "danie makal" returned nothing even though Daniel
 * Makalski exists, because the whole query string was matched inside each column
 * and no single column contains both names.
 */
// Must come first: src/lib/db throws at module-evaluation time if DATABASE_URL
// is unset, and imports are evaluated in order.
import "dotenv/config";
import { db } from "../../src/lib/db";
import { users } from "../../src/lib/db/schema";
import { buildUserSearchCondition } from "../../src/lib/admin/user-search";
import { desc } from "drizzle-orm";

const QUERIES = [
  "danie makal",
  "daniel makalski",
  "Daniel Makalski",
  "makal danie", // order must not matter
  "  daniel   makalski  ", // extra whitespace
  "daniel",
  "makalski",
  "d",
  "makalski daniel zzz", // one term matches nothing -> no results
  "ahuva edell",
  "",
];

async function main() {
  console.log("admin user search — live results\n");

  for (const q of QUERIES) {
    const condition = buildUserSearchCondition(q);
    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(condition)
      .orderBy(desc(users.id))
      .limit(4);

    const label = JSON.stringify(q);
    console.log(`${label.padEnd(26)} -> ${rows.length} row(s)${condition ? "" : "  (no filter)"}`);
    for (const r of rows) {
      console.log(`    #${r.id} ${r.firstName ?? ""} ${r.lastName ?? ""} <${r.email}>`);
    }
  }

  // The specific regression, asserted rather than eyeballed.
  const target = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(buildUserSearchCondition("danie makal"));

  console.log(
    `\n"danie makal" finds Daniel Makalski: ${target.length > 0 ? "YES" : "NO — STILL BROKEN"}`
  );
  if (target.length === 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("ERROR:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
