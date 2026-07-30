/**
 * Deletes the imported (legacy) shiva notices, leaving natively-created ones.
 *
 *   npx tsx scripts/legacy-import/delete-imported-shiva.ts            # dry run
 *   npx tsx scripts/legacy-import/delete-imported-shiva.ts --commit
 *
 * Why: all 3,553 imported notices are long expired, so the public page (which
 * filters shiva_end >= today) never shows them; their prose lives in notice_text
 * which no UI renders; and because the import did not carry the original post
 * date into created_at, they sorted to the top of the admin queue and buried the
 * one real notice.
 *
 * Reversible: the legacy MSSQL database is untouched and
 * scripts/legacy-import/shiva.ts is idempotent, so
 * `npx tsx scripts/legacy-import/shiva.ts --commit` restores all of them.
 *
 * Safety: the WHERE clause is `old_id IS NOT NULL`, which by construction can
 * only match imported rows — every natively-created notice has old_id NULL. The
 * script asserts the native count is unchanged afterwards and aborts the run as
 * a failure if it is not.
 */
import { connectTarget, parseOptions } from "./lib";

async function main() {
  const opts = parseOptions();
  const target = connectTarget(opts.useTest);

  console.log("=".repeat(72));
  console.log("DELETE IMPORTED SHIVA NOTICES");
  console.log("=".repeat(72));
  console.log(`Target : ${target.isTest ? "TEST BRANCH" : "PRIMARY"} (${target.host})`);
  console.log(`Mode   : ${opts.commit ? "COMMIT (will delete)" : "DRY RUN (no writes)"}\n`);

  const countRow = async () => {
    const r = (await target.sql.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE old_id IS NOT NULL)::int AS imported,
         COUNT(*) FILTER (WHERE old_id IS NULL)::int AS native,
         COUNT(*) FILTER (WHERE shiva_end >= CURRENT_DATE)::int AS still_current
       FROM shiva_notifications`
    )) as { total: number; imported: number; native: number; still_current: number }[];
    return r[0];
  };

  const before = await countRow();
  console.log("BEFORE");
  console.log(`  total            : ${before.total}`);
  console.log(`  imported (legacy): ${before.imported}   <- to delete`);
  console.log(`  native (kept)    : ${before.native}`);
  console.log(`  still current    : ${before.still_current}`);

  // Refuse to run if any imported notice is somehow still active — that would
  // mean deleting something the public page is currently showing.
  const currentImported = (await target.sql.query(
    `SELECT COUNT(*)::int n FROM shiva_notifications
      WHERE old_id IS NOT NULL AND shiva_end >= CURRENT_DATE`
  )) as { n: number }[];

  if (currentImported[0].n > 0) {
    console.error(
      `\nREFUSED: ${currentImported[0].n} imported notice(s) are still within their shiva window ` +
        `and are visible on the public page. Review them before deleting.`
    );
    process.exit(1);
  }
  console.log("\n  check: no imported notice is still within its shiva window — ok");

  if (!opts.commit) {
    console.log("\nDRY RUN — nothing deleted. Re-run with --commit to apply.");
    console.log("Restore at any time with: npx tsx scripts/legacy-import/shiva.ts --commit");
    return;
  }

  await target.sql.query(`DELETE FROM shiva_notifications WHERE old_id IS NOT NULL`);

  const after = await countRow();
  console.log("\nAFTER");
  console.log(`  total            : ${after.total}`);
  console.log(`  imported (legacy): ${after.imported}`);
  console.log(`  native (kept)    : ${after.native}`);

  if (after.native !== before.native) {
    console.error(
      `\nFAILED: native notice count changed (${before.native} -> ${after.native}). ` +
        `Restore with: npx tsx scripts/legacy-import/shiva.ts --commit`
    );
    process.exit(1);
  }
  if (after.imported !== 0) {
    console.error(`\nFAILED: ${after.imported} imported rows remain.`);
    process.exit(1);
  }

  console.log(
    `\nDONE. Deleted ${before.imported} imported notices; all ${after.native} native notice(s) intact.`
  );
  console.log("Restore with: npx tsx scripts/legacy-import/shiva.ts --commit");
}

main().catch((e) => {
  console.error("\nERROR:", e instanceof Error ? e.stack : e);
  process.exit(1);
});
