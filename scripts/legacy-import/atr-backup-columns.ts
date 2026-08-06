/**
 * Snapshots the four mutable Ask the Rabbi fields into backup columns on the
 * same row, so any change to the archive can be undone per-row.
 *
 *   npx tsx scripts/legacy-import/atr-backup-columns.ts            # dry run
 *   npx tsx scripts/legacy-import/atr-backup-columns.ts --commit
 *   npx tsx scripts/legacy-import/atr-backup-columns.ts --verify   # compare only
 *
 * WHY COLUMNS AND NOT A BACKUP TABLE
 *
 * The backup travels with the row, so restoring is a single UPDATE per row with
 * no lookup file and no join. For the operation this protects — reverting the
 * 5 Aug renumbering, which is UPDATEs only — that is sufficient.
 *
 * KNOWN LIMIT: a column backup dies with its row. It does NOT protect against a
 * DELETE or a dropped table; a Neon branch or a separate table would. It also
 * only covers the four fields duplicated here, not the whole record.
 *
 * SAFE FOR THE RUNNING APP: verified there is no raw "SELECT *" against
 * ask_the_rabbi anywhere in src/, and Drizzle builds explicit column lists from
 * schema.ts (12 columns). Columns absent from the schema are invisible to the
 * application, so this needs no code change and no deploy.
 *
 * The columns are nullable with no default, so PostgreSQL adds them instantly
 * without rewriting the table.
 *
 * TO RESTORE a row to its snapshot:
 *   UPDATE ask_the_rabbi
 *      SET question_number = bak_question_number,
 *          title           = bak_title,
 *          question        = bak_question,
 *          answer          = bak_answer
 *    WHERE id = <id>;
 */
import { announce, connectTarget, parseOptions } from "./lib";

const FIELDS = ["question_number", "title", "question", "answer"] as const;

async function main() {
  const opts = parseOptions();
  const verifyOnly = process.argv.includes("--verify");
  const target = connectTarget(opts.useTest);
  announce("ASK THE RABBI — BACKUP COLUMNS", opts, target);

  const [before] = (await target.sql.query(
    `SELECT count(*)::int AS rows,
            pg_size_pretty(pg_total_relation_size('ask_the_rabbi')) AS size
       FROM ask_the_rabbi`
  )) as { rows: number; size: string }[];
  console.log(`Table: ${before.rows} rows, ${before.size}`);

  const existing = (await target.sql.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'ask_the_rabbi' AND column_name LIKE 'bak_%'`
  )) as { column_name: string }[];
  console.log(`Existing backup columns: ${existing.length ? existing.map((c) => c.column_name).join(", ") : "(none)"}`);

  if (!verifyOnly) {
    if (!opts.commit) {
      console.log("\nWould run:");
      console.log(`  ALTER TABLE ask_the_rabbi ADD COLUMN IF NOT EXISTS bak_question_number INTEGER,`);
      console.log(`    ADD COLUMN IF NOT EXISTS bak_title VARCHAR(255),`);
      console.log(`    ADD COLUMN IF NOT EXISTS bak_question TEXT,`);
      console.log(`    ADD COLUMN IF NOT EXISTS bak_answer TEXT;`);
      console.log(`  UPDATE ask_the_rabbi SET bak_* = <current values>;   -- ${before.rows} rows`);
      console.log("\nDRY RUN — nothing written. Re-run with --commit to apply.");
      return;
    }

    console.log("\nAdding columns...");
    await target.sql.query(`
      ALTER TABLE ask_the_rabbi
        ADD COLUMN IF NOT EXISTS bak_question_number INTEGER,
        ADD COLUMN IF NOT EXISTS bak_title           VARCHAR(255),
        ADD COLUMN IF NOT EXISTS bak_question        TEXT,
        ADD COLUMN IF NOT EXISTS bak_answer          TEXT`);

    console.log("Populating...");
    await target.sql.query(`
      UPDATE ask_the_rabbi SET
        bak_question_number = question_number,
        bak_title           = title,
        bak_question        = question,
        bak_answer          = answer`);
  }

  // ---- verification: every row's backup must equal its live value.
  // IS DISTINCT FROM, not <>, so NULL = NULL counts as equal rather than
  // returning NULL and silently dropping out of the count.
  console.log("\nVERIFY");
  let bad = 0;
  for (const f of FIELDS) {
    const [r] = (await target.sql.query(
      `SELECT count(*)::int AS n FROM ask_the_rabbi WHERE bak_${f} IS DISTINCT FROM ${f}`
    )) as { n: number }[];
    console.log(`  ${`bak_${f}`.padEnd(22)} mismatches: ${r.n}`);
    bad += r.n;
  }

  const [cov] = (await target.sql.query(
    `SELECT count(*)::int AS rows,
            count(bak_title)::int AS titles_backed_up,
            count(bak_question)::int AS questions_backed_up,
            count(bak_question_number)::int AS numbers_backed_up,
            count(bak_answer)::int AS answers_backed_up
     FROM ask_the_rabbi`
  )) as Record<string, number>[];
  console.log(`\n  rows                : ${cov.rows}`);
  console.log(`  bak_title populated : ${cov.titles_backed_up}  (must equal rows — title is NOT NULL)`);
  console.log(`  bak_question        : ${cov.questions_backed_up}  (must equal rows — question is NOT NULL)`);
  console.log(`  bak_question_number : ${cov.numbers_backed_up}  (nullable — matches how many rows have a number)`);
  console.log(`  bak_answer          : ${cov.answers_backed_up}  (nullable — matches how many rows have an answer)`);

  const [after] = (await target.sql.query(
    `SELECT pg_size_pretty(pg_total_relation_size('ask_the_rabbi')) AS size`
  )) as { size: string }[];
  console.log(`\n  table size: ${before.size} -> ${after.size}`);

  console.log(
    bad === 0 && cov.titles_backed_up === cov.rows
      ? "\n✅ BACKUP COMPLETE AND VERIFIED — every row's snapshot matches its current value."
      : `\n❌ PROBLEM: ${bad} field mismatches. Do NOT proceed with any change.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
