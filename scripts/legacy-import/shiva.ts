/**
 * Imports the 3,553 legacy shiva notices (FrumShared BlogEntries category 85)
 * into `shiva_notifications`.
 *
 *   npx tsx scripts/legacy-import/shiva.ts                 # dry run
 *   npx tsx scripts/legacy-import/shiva.ts --commit
 *   npx tsx scripts/legacy-import/shiva.ts --repair --commit
 *
 * Structural mismatch, handled deliberately:
 *
 * - The target table models structured shiva logistics; the legacy rows are one
 *   prose announcement each. The body goes to `notice_text` (added by
 *   migrations/2026-07-29-shiva-notice-text.sql) rather than being forced into
 *   levaya_info, which would mislabel it. mourner_names, shiva_address, hours,
 *   davening/zoom/minyan/meal/donation fields stay NULL — they exist inside the
 *   prose, and guessing them with regexes would fabricate logistics for real
 *   families.
 *
 * - shiva_start / shiva_end are NOT NULL and the legacy schema records no dates
 *   at all, so start = post date and end = post date + 7. Every legacy notice is
 *   long expired (newest post 2026-03-27), and the public page filters on
 *   shiva_end >= today, so these dates never drive a live display — they exist to
 *   satisfy the constraint and order the archive.
 *
 * - niftar_name is extracted from the title by extractNiftarName() in ./parse.
 *   Its prefix and honorific vocabularies were tallied from all 3,553 real
 *   titles rather than guessed, and are covered by tests/unit/legacy-import-shiva.
 */
import {
  announce,
  addDaysToDateString,
  chunk,
  connectLegacy,
  connectTarget,
  fit,
  htmlToLine,
  htmlToText,
  loadLegacyEnv,
  oleToDateString,
  parseOptions,
} from "./lib";
import { parseShivaTitle } from "./parse";

const SHIVA_CATEGORY = 85;
const SHIVA_DAYS = 7;

interface Entry {
  BlogEntryID: number;
  Active: boolean | null;
  OnHold: boolean | null;
  BlogEntryDate: number | null;
  BlogEntryTitle: string | null;
  BlogEntryText: string | null;
}

async function main() {
  const opts = parseOptions();
  const repairMode = process.argv.includes("--repair");
  loadLegacyEnv();
  const target = connectTarget(opts.useTest);
  announce("LEGACY SHIVA IMPORT — BlogEntries(85) -> shiva_notifications", opts, target);

  // Fail loudly if the migration has not been applied.
  const col = (await target.sql.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name='shiva_notifications' AND column_name='notice_text'`
  )) as { column_name: string }[];
  if (col.length === 0) {
    throw new Error(
      "shiva_notifications.notice_text is missing. Apply migrations/2026-07-29-shiva-notice-text.sql first."
    );
  }

  const pool = await connectLegacy("FrumShared");
  const entries: Entry[] = (
    await pool.request().query(`
      SELECT BlogEntryID, Active, OnHold, BlogEntryDate, BlogEntryTitle, BlogEntryText
      FROM BlogEntries WHERE BlogCategoryID = ${SHIVA_CATEGORY}
      ORDER BY BlogEntryDate, BlogEntryID`)
  ).recordset;
  await pool.close();
  console.log(`Read ${entries.length} legacy shiva entries.`);

  const existing = (await target.sql.query(
    `SELECT old_id FROM shiva_notifications WHERE old_id IS NOT NULL`
  )) as { old_id: number }[];
  const already = new Set(existing.map((r) => r.old_id));
  console.log(`Already imported: ${already.size}`);

  let pending = repairMode
    ? entries.filter((e) => already.has(e.BlogEntryID))
    : entries.filter((e) => !already.has(e.BlogEntryID));
  if (opts.limit) pending = pending.slice(0, opts.limit);

  interface Prepared {
    oldId: number;
    niftarName: string;
    niftarNameHebrew: string | null;
    noticeText: string;
    start: string;
    end: string;
  }

  const prepared: Prepared[] = [];
  const skipped: { id: number; why: string }[] = [];
  const suspiciousNames: Prepared[] = [];

  for (const e of pending) {
    const title = htmlToLine(e.BlogEntryTitle);
    const body = htmlToText(e.BlogEntryText);
    const start = oleToDateString(e.BlogEntryDate);

    if (!start) {
      skipped.push({ id: e.BlogEntryID, why: "unparseable BlogEntryDate" });
      continue;
    }
    if (!title && !body) {
      skipped.push({ id: e.BlogEntryID, why: "empty title and body" });
      continue;
    }

    const parsed = parseShivaTitle(title);
    const name = parsed.name || title;
    if (!name) {
      skipped.push({ id: e.BlogEntryID, why: "could not derive a niftar name" });
      continue;
    }

    const row: Prepared = {
      oldId: e.BlogEntryID,
      niftarName: fit(name, 200),
      niftarNameHebrew: parsed.hebrewName ? fit(parsed.hebrewName, 200) : null,
      noticeText: body || title,
      start,
      end: addDaysToDateString(start, SHIVA_DAYS),
    };
    prepared.push(row);

    // Flag names that still look like a phrase rather than a person, so the
    // extraction quality is visible instead of assumed.
    if (row.niftarName.split(/\s+/).length > 6 || /notic|shiva|funeral|bereav/i.test(row.niftarName)) {
      suspiciousNames.push(row);
    }
  }

  console.log("\nPLAN");
  console.log(`  to ${repairMode ? "repair" : "insert"} : ${prepared.length}`);
  console.log(`  skipped            : ${skipped.length}`);
  console.log(`  names needing review: ${suspiciousNames.length} (${((suspiciousNames.length / Math.max(1, prepared.length)) * 100).toFixed(1)}%)`);

  const withHebrew = prepared.filter((p) => p.niftarNameHebrew).length;
  console.log(`  with a Hebrew name : ${withHebrew}`);

  const latestEnd = prepared.reduce((m, p) => (p.end > m ? p.end : m), "0000-00-00");
  console.log(`  latest shiva_end   : ${latestEnd} (all expired => never shown on the public page)`);

  console.log("\n  sample extracted names:");
  for (const p of prepared.slice(-8)) {
    console.log(`    #${p.oldId} ${p.start} -> ${JSON.stringify(p.niftarName)}`);
  }

  if (suspiciousNames.length) {
    console.log("\n  names needing review (first 10):");
    suspiciousNames.slice(0, 10).forEach((p) =>
      console.log(`    #${p.oldId} ${JSON.stringify(p.niftarName)}`)
    );
  }

  if (skipped.length) {
    console.log("\n  skipped:");
    skipped.slice(0, 10).forEach((s) => console.log(`    #${s.id}: ${s.why}`));
  }

  if (!opts.commit) {
    console.log("\nDRY RUN — nothing written. Re-run with --commit to apply.");
    return;
  }
  if (prepared.length === 0) {
    console.log("\nNothing to do.");
    return;
  }

  if (repairMode) {
    console.log("\nRepairing...");
    let n = 0;
    for (const batch of chunk(prepared, 200)) {
      const values: unknown[] = [];
      const tuples: string[] = [];
      batch.forEach((p, i) => {
        const b = i * 4;
        tuples.push(`($${b + 1}::int, $${b + 2}::text, $${b + 3}::text, $${b + 4}::text)`);
        values.push(p.oldId, p.niftarName, p.niftarNameHebrew, p.noticeText);
      });
      await target.sql.query(
        `UPDATE shiva_notifications AS s
            SET niftar_name = v.niftar_name,
                niftar_name_hebrew = v.niftar_name_hebrew,
                notice_text = v.notice_text
           FROM (VALUES ${tuples.join(",")})
                AS v(old_id, niftar_name, niftar_name_hebrew, notice_text)
          WHERE s.old_id = v.old_id
            AND (s.niftar_name <> v.niftar_name
                 OR s.niftar_name_hebrew IS DISTINCT FROM v.niftar_name_hebrew
                 OR s.notice_text IS DISTINCT FROM v.notice_text)`,
        values
      );
      n += batch.length;
      console.log(`  processed ${n}/${prepared.length}`);
    }
    console.log(`\nDONE. Repair pass covered ${n} rows.`);
    return;
  }

  console.log("\nInserting...");
  let done = 0;
  for (const batch of chunk(prepared, 200)) {
    const values: unknown[] = [];
    const tuples: string[] = [];
    batch.forEach((p, i) => {
      const b = i * 7;
      tuples.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7})`);
      values.push(
        p.niftarName,
        p.niftarNameHebrew,
        p.noticeText,
        p.start,
        p.end,
        "approved",
        p.oldId
      );
    });
    await target.sql.query(
      `INSERT INTO shiva_notifications
         (niftar_name, niftar_name_hebrew, notice_text, shiva_start, shiva_end,
          approval_status, old_id)
       VALUES ${tuples.join(",")}
       ON CONFLICT (old_id) WHERE old_id IS NOT NULL DO NOTHING`,
      values
    );
    done += batch.length;
    console.log(`  ${done}/${prepared.length}`);
  }
  console.log(`\nDONE. shiva_notifications +${done}`);
}

main().catch((e) => {
  console.error("\nERROR:", e instanceof Error ? e.stack : e);
  process.exit(1);
});
