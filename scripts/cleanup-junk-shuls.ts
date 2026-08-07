/**
 * Removes the five junk shul rows and everything attached to them.
 *
 *   id 1  makra.ca                              (dev leftover)
 *   id 2  [TEST] Beth Jacob V'Anshei Drildz     duplicates real id 9
 *   id 3  [TEST] Chabad of Midtown
 *   id 4  [TEST] Shaarei Shomayim Congregation  duplicates real id 7
 *   id 5  [TEST] Sephardic Kehila Centre
 *
 * All five are `is_active = true` and therefore live on the public /shuls page.
 * Two of them duplicate real shuls already in the table — which is why they are
 * DELETED rather than renamed: renaming would leave two rows for one
 * congregation, and a member typing that name would then match both and be left
 * unlinked by the affiliation import.
 *
 * Audited before writing this (2026-08-07): everything attached is test data.
 * 21 events, all dated Jan/Mar 2026 (in the past), 20 of them titled "[TEST] …";
 * 3 davening times on makra.ca; one user_shuls row for a test account. Nothing
 * is publicly visible on the calendar today.
 *
 * The 24 OTHER "[TEST]"-titled events elsewhere in the table are deliberately
 * left alone — different decision, not covered here.
 *
 * Order matters: events.shul_id and shiurim.shul_id are NO ACTION, so those rows
 * must go first or the shul DELETE is rejected. Everything else cascades.
 *
 * Usage:
 *   npx tsx scripts/cleanup-junk-shuls.ts            # dry run, prints the snapshot
 *   npx tsx scripts/cleanup-junk-shuls.ts --commit   # writes
 *   npx tsx scripts/cleanup-junk-shuls.ts --commit --test   # against the test branch
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { writeFileSync } from "node:fs";

const useTest = process.argv.includes("--test");
config({ path: useTest ? ".env.test" : ".env" });

const commit = process.argv.includes("--commit");
const JUNK_IDS = [1, 2, 3, 4, 5];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = neon(url);

  console.log(`Target: ${useTest ? "TEST BRANCH" : "PRIMARY"} (${new URL(url).host})`);
  console.log(`Mode:   ${commit ? "COMMIT — this will delete" : "DRY RUN"}\n`);

  const shuls = await sql`
    SELECT id, name, slug, is_active FROM shuls WHERE id = ANY(${JUNK_IDS}) ORDER BY id`;

  if (shuls.length === 0) {
    console.log("Nothing to do — none of those ids exist.");
    return;
  }

  // Snapshot everything first. The delete is irreversible, so this is the only
  // record that will exist of what was there.
  const snapshot: Record<string, unknown> = { takenAt: new Date().toISOString(), shuls };
  for (const table of [
    "events",
    "shiurim",
    "davening_schedules",
    "shul_documents",
    "shul_registration_requests",
    "user_shuls",
  ]) {
    // sql.query, not the tagged template — the table name is interpolated here
    // and it comes from the hardcoded list above, never from input.
    snapshot[table] = await sql.query(
      `SELECT * FROM ${table} WHERE shul_id = ANY($1)`,
      [JUNK_IDS]
    );
  }

  console.log("About to remove:");
  for (const s of shuls as { id: number; name: string; slug: string }[]) {
    console.log(`  #${s.id}  ${s.name}  (/shuls/${s.slug})`);
  }
  console.log("");
  for (const [table, rows] of Object.entries(snapshot)) {
    if (Array.isArray(rows) && table !== "shuls") {
      console.log(`  ${table.padEnd(28)} ${rows.length} row(s)`);
    }
  }

  const snapshotPath = `junk-shul-snapshot-${Date.now()}.json`;
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  console.log(`\nSnapshot written to ${snapshotPath} (gitignored — keep it until you are sure)`);

  if (!commit) {
    console.log("\nDry run. Re-run with --commit to apply.");
    return;
  }

  // NO ACTION children first, or the shul delete is rejected.
  const ev = await sql`DELETE FROM events WHERE shul_id = ANY(${JUNK_IDS}) RETURNING id`;
  const sh = await sql`DELETE FROM shiurim WHERE shul_id = ANY(${JUNK_IDS}) RETURNING id`;
  console.log(`\ndeleted events:  ${ev.length}`);
  console.log(`deleted shiurim: ${sh.length}`);

  // The rest cascade, but delete explicitly so the counts are visible.
  for (const table of ["davening_schedules", "shul_documents", "shul_registration_requests", "user_shuls"]) {
    const rows = await sql.query(
      `DELETE FROM ${table} WHERE shul_id = ANY($1) RETURNING id`,
      [JUNK_IDS]
    );
    console.log(`deleted ${table}: ${rows.length}`);
  }

  const gone = await sql`DELETE FROM shuls WHERE id = ANY(${JUNK_IDS}) RETURNING id, name`;
  console.log(`deleted shuls:   ${gone.length}`);

  const remaining = await sql`SELECT id, name, slug FROM shuls ORDER BY id`;
  console.log(`\nRemaining shuls (${remaining.length}):`);
  for (const r of remaining as { id: number; name: string; slug: string }[]) {
    console.log(`  #${r.id}  ${r.name}  (/shuls/${r.slug})`);
  }

  const [check] = await sql`
    SELECT count(*)::int n FROM shuls
    WHERE name LIKE '[TEST]%' OR slug LIKE 'test-%' OR name = 'makra.ca'`;
  console.log(`\nJunk-looking rows left: ${check.n}${check.n ? "  <-- INVESTIGATE" : ""}`);
}

main().catch((error) => {
  console.error("FAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});
