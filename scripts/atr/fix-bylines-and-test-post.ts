/**
 * One-off repair of the Ask the Rabbi library.
 *
 * 1. Nine published Q&As (the numbered 6012-6024 series) are credited to
 *    "Admin User" instead of the Rav. Quick Publish had no "Answered By" field,
 *    so the route substituted whoever was logged in over a column default that
 *    was already correct. The code fix landed in d533897; this repairs the rows
 *    that were written before it.
 *
 * 2. Row 5519 — question #8204, "THis is a test for Ask the rabbi" — is test
 *    content live on the public Q&A page. It is one of the ten wrong bylines
 *    but must NOT be backfilled: crediting a test post to the Rav is worse than
 *    leaving it. It gets deleted, after its full row is written to JSON.
 *
 * Dry-run by default; pass --commit to apply.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const COMMIT = process.argv.includes("--commit");
const RAV = "Hagaon Rav Shlomo Miller Shlit'a";
const BYLINE_IDS = [5520, 5521, 5522, 5523, 5524, 5525, 5526, 5527, 5528];
const TEST_POST_ID = 5519;

async function main() {
  const { db } = await import("@/lib/db");
  const { askTheRabbi } = await import("@/lib/db/schema");
  const { inArray, eq } = await import("drizzle-orm");

  // Re-verify before touching anything. The ids come from a document written
  // days ago; a stale id list is exactly how the wrong row gets rewritten.
  const targets = await db
    .select()
    .from(askTheRabbi)
    .where(inArray(askTheRabbi.id, BYLINE_IDS));

  console.log(`\nByline targets found: ${targets.length} (expected 9)\n`);
  for (const r of targets) {
    console.log(`  #${r.questionNumber}  "${r.title}"`);
    console.log(`           "${r.answeredBy}"  ->  "${RAV}"`);
  }
  if (targets.length !== 9) {
    throw new Error(`Expected exactly 9 rows, found ${targets.length}. Aborting.`);
  }

  const alreadyRight = targets.filter((r) => r.answeredBy === RAV).length;
  if (alreadyRight > 0) {
    console.warn(`\nNote: ${alreadyRight} already carry the correct byline.`);
  }

  const [testPost] = await db
    .select()
    .from(askTheRabbi)
    .where(eq(askTheRabbi.id, TEST_POST_ID));

  if (!testPost) {
    throw new Error(`Test post ${TEST_POST_ID} not found. Aborting.`);
  }
  // The delete is the one irreversible step in this project. Refuse if the row
  // is not what the plan says it is.
  if (!/test/i.test(testPost.title)) {
    throw new Error(
      `Row ${TEST_POST_ID} is "${testPost.title}" — not the expected test post. Aborting.`
    );
  }
  console.log(`\nTest post to DELETE:\n  #${testPost.questionNumber}  "${testPost.title}"`);

  if (!COMMIT) {
    console.log("\nDRY RUN — nothing written. Pass --commit to apply.\n");
    return;
  }

  const { writeFileSync } = await import("node:fs");
  const backup = `scripts/atr/deleted-question-${TEST_POST_ID}.json`;
  writeFileSync(backup, JSON.stringify(testPost, null, 2));
  console.log(`\nBacked up row ${TEST_POST_ID} to ${backup}`);

  // Update first, then delete. neon-http has no transactions, so these are two
  // round trips; this order means a failure between them leaves the bylines
  // fixed and the test post still present — the recoverable half.
  const updated = await db
    .update(askTheRabbi)
    .set({ answeredBy: RAV })
    .where(inArray(askTheRabbi.id, BYLINE_IDS))
    .returning({ id: askTheRabbi.id });
  console.log(`Rewrote ${updated.length} bylines.`);

  const deleted = await db
    .delete(askTheRabbi)
    .where(eq(askTheRabbi.id, TEST_POST_ID))
    .returning({ id: askTheRabbi.id });
  console.log(`Deleted ${deleted.length} test post.\n`);
}

main().catch((err) => {
  console.error(`\n${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
