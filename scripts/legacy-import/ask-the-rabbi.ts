/**
 * Imports the Ask the Rabbi questions that the original migration missed
 * (FrumShared BlogEntries category 98 -> ask_the_rabbi).
 *
 *   npx tsx scripts/legacy-import/ask-the-rabbi.ts                 # dry run
 *   npx tsx scripts/legacy-import/ask-the-rabbi.ts --commit
 *   npx tsx scripts/legacy-import/ask-the-rabbi.ts --test --commit
 *   npx tsx scripts/legacy-import/ask-the-rabbi.ts --repair            # re-split Q&A
 *   npx tsx scripts/legacy-import/ask-the-rabbi.ts --repair --commit
 *
 * WHY THIS EXISTS
 *
 * scripts/migrate-ask-rabbi.js ran once around December 2025 and imported 5,511
 * of the 5,835 active legacy questions. The rabbi then kept posting on the OLD
 * site for another seven months, through #6011 on 2026-07-18, before switching
 * to the new admin at #6012 on 2026-07-23. Those months never came across.
 *
 * A further handful were lost to a bug rather than to timing: the old script
 * wrapped each INSERT in a try/catch that only incremented a counter, so rows
 * rejected by UNIQUE(question_number) vanished with no record. See
 * extractQuestionNumber() in ./parse for the entity-matching bug that caused
 * most of those rejections.
 *
 * WHAT IT DOES WITH COLLISIONS
 *
 * The legacy site reused question numbers in two different ways, and they need
 * opposite treatment:
 *
 *   1. The SAME question posted twice (a double-click, or a corrected re-post
 *      days later). The second copy is skipped. Detected by body similarity,
 *      not string equality — the re-posts differ by a stray "- Q." prefix or a
 *      prepended header, so they can share no common prefix at all.
 *
 *   2. Two DIFFERENT questions given the same number. Genuine misnumbering, so
 *      the new question is inserted directly after the existing one and the
 *      block above it shifts up by one, stopping at the first free number.
 *      Both the question_number column AND the "#NNNN" written into each title
 *      are rewritten, because the number is stored in both places: 1,600 of the
 *      1,609 numbered rows carry their number inside the title text.
 *
 * The shift is bounded by the first gap in the sequence, which is why this
 * touches ~36 rows rather than every row above the collision.
 *
 * SAFETY
 *
 * - Dry run by default; --commit is required to write anything.
 * - Every renumbered row is snapshotted to a JSON file before it is touched.
 * - Renumbering runs in DESCENDING order. UNIQUE(question_number) is enforced
 *   per statement and neon-http has no transactions, so ascending order would
 *   collide on the second write.
 * - Reads against MSSQL are SELECT-only.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  announce,
  connectLegacy,
  connectTarget,
  fit,
  htmlToLine,
  htmlToText,
  loadLegacyEnv,
  oleToTimestamp,
  parseOptions,
} from "./lib";
import {
  bodySimilarity,
  extractQuestionNumber,
  renumberTitle,
  splitQuestionAnswer,
} from "./parse";

const ATR_CATEGORY = 98;

/**
 * Bodies scoring at or above this against another question with the same number
 * are treated as the same question posted twice. Measured against the real
 * collisions: the eight re-post pairs score 0.93-1.00, while the one genuine
 * misnumbering (#5264 "Safe Sick Music?" vs "A Happy Yohrzait?") scores far
 * lower. The dry run prints every score so the threshold stays checkable.
 */
const DUPLICATE_THRESHOLD = 0.9;

/** Row id whose question_number was scraped out of the "&#8203;" entity. */
const ENTITY_BUG_ROW = { id: 2011, wrong: 8203, correct: 2006 };

interface Entry {
  BlogEntryID: number;
  BlogEntryTitle: string | null;
  BlogEntryText: string | null;
  BlogEntryDate: number | null;
}

interface ExistingRow {
  id: number;
  question_number: number | null;
  title: string;
  question: string;
  answer: string | null;
}

interface Insert {
  oldId: number;
  questionNumber: number | null;
  title: string;
  question: string;
  answer: string | null;
  publishedAt: Date;
  /** Set when the row had to be moved off its own number by a cascade. */
  renumberedFrom?: number;
}

interface Renumber {
  id: number;
  from: number;
  to: number;
  titleFrom: string;
  titleTo: string;
}

interface Skip {
  oldId: number;
  title: string;
  why: string;
  detail?: string;
}

/**
 * --repair: re-splits imported rows that ended up with the whole Q&A body in
 * the `question` column and nothing in `answer`.
 *
 * No legacy read is needed — the stored `question` still holds the full text,
 * so this re-runs splitQuestionAnswer over what is already in Postgres. Only
 * rows carrying an old_blog_entry_id are considered, so a hand-written admin
 * post that genuinely has no answer yet is never touched.
 */
async function repair(opts: ReturnType<typeof parseOptions>, target: ReturnType<typeof connectTarget>) {
  const rows = (await target.sql.query(
    `SELECT id, question_number, title, question FROM ask_the_rabbi
     WHERE old_blog_entry_id IS NOT NULL AND (answer IS NULL OR btrim(answer) = '')
     ORDER BY id`
  )) as { id: number; question_number: number | null; title: string; question: string }[];
  console.log(`Rows with no answer: ${rows.length}`);

  const fixes: { id: number; title: string; question: string; answer: string; wasLen: number }[] = [];
  const stillNone: { id: number; title: string; preview: string }[] = [];

  for (const r of rows) {
    const { question, answer } = splitQuestionAnswer(r.question);
    if (answer && question.length >= 10) {
      fixes.push({ id: r.id, title: r.title, question, answer, wasLen: r.question.length });
    } else {
      stillNone.push({ id: r.id, title: r.title, preview: r.question.replace(/\n/g, " ").slice(0, 100) });
    }
  }

  console.log(`\nPLAN\n  repairable : ${fixes.length}\n  no marker  : ${stillNone.length} (genuinely have no "A." in the text)\n`);

  for (const f of fixes) {
    console.log(`  row ${String(f.id).padEnd(5)} "${f.title}"`);
    console.log(`    Q (${f.question.length}): ${f.question.replace(/\n/g, " ").slice(0, 150)}`);
    console.log(`    A (${f.answer.length}): ${f.answer.replace(/\n/g, " ").slice(0, 150)}`);
    // A split that drops characters would mean text was lost, not moved.
    const moved = f.question.length + f.answer.length;
    if (moved < f.wasLen - 40) console.log(`    !! WARNING: ${f.wasLen - moved} chars unaccounted for`);
  }

  if (stillNone.length) {
    console.log(`\n  left alone (no answer marker present):`);
    stillNone.slice(0, 8).forEach((s) => console.log(`    row ${s.id} "${s.title}" — ${s.preview}`));
  }

  // --- rows the ORIGINAL 2025 migration split on the byline's initial.
  //
  // Its regex was /\n\s*A\.\s*/, which happily matched the "A." in the sign-off
  // "Rabbi\nA. Bartfeld as revised by Horav Shlomo Miller Shlit'a" — so the
  // answer column holds a fragment of the signature ("Bartfeld") while the real
  // ruling stayed in the question. Re-derived from the legacy source rather
  // than by rejoining the two columns: the exact separator the old regex
  // consumed is unknowable from what is stored, and inventing one would put
  // characters into the archive that the rabbi never wrote.
  const bylineRows = (await target.sql.query(
    `SELECT id, old_blog_entry_id, title, question, answer FROM ask_the_rabbi
     WHERE old_blog_entry_id IS NOT NULL AND answer ~* '^(Bartfeld|as revised by|as advised by)'
     ORDER BY id`
  )) as { id: number; old_blog_entry_id: number; title: string; question: string; answer: string }[];

  const bylineFixes: { id: number; title: string; question: string; answer: string | null; was: string }[] = [];
  if (bylineRows.length) {
    console.log(`\nBYLINE MIS-SPLITS FROM THE ORIGINAL MIGRATION: ${bylineRows.length}`);
    const pool = await connectLegacy("FrumShared");
    for (const r of bylineRows) {
      const src = (
        await pool
          .request()
          .query(`SELECT BlogEntryText FROM BlogEntries WHERE BlogEntryID = ${r.old_blog_entry_id}`)
      ).recordset[0];
      if (!src) {
        console.log(`  row ${r.id}: legacy entry ${r.old_blog_entry_id} not found — LEFT ALONE`);
        continue;
      }
      const body = htmlToText(src.BlogEntryText);
      const { question, answer } = splitQuestionAnswer(body);
      console.log(`  row ${r.id} "${r.title}"`);
      console.log(`    was  Q(${r.question.length}) ...${r.question.replace(/\n/g, " ").slice(-70)}`);
      console.log(`         A(${r.answer.length}) ${r.answer.replace(/\n/g, " ").slice(0, 70)}`);
      console.log(`    now  Q(${question.length}) ...${question.replace(/\n/g, " ").slice(-70)}`);
      console.log(`         A ${answer ? `(${answer.length}) ${answer.replace(/\n/g, " ").slice(0, 70)}` : "= NULL (byline is not an answer)"}`);
      bylineFixes.push({ id: r.id, title: r.title, question, answer, was: r.question });
    }
    await pool.close();
  }

  if (!opts.commit) {
    console.log("\nDRY RUN — nothing written. Re-run with --repair --commit to apply.");
    return;
  }

  console.log(`\nRepairing ${fixes.length} split rows and ${bylineFixes.length} byline rows...`);
  for (const f of fixes) {
    await target.sql.query(`UPDATE ask_the_rabbi SET question = $1, answer = $2 WHERE id = $3`, [
      f.question,
      f.answer,
      f.id,
    ]);
  }
  for (const f of bylineFixes) {
    await target.sql.query(`UPDATE ask_the_rabbi SET question = $1, answer = $2 WHERE id = $3`, [
      f.question,
      f.answer,
      f.id,
    ]);
  }
  console.log("Done.");
}

async function main() {
  const opts = parseOptions();
  const repairMode = process.argv.includes("--repair");
  loadLegacyEnv();
  const target = connectTarget(opts.useTest);
  announce(
    repairMode
      ? "ASK THE RABBI — RE-SPLIT Q&A ON ANSWER-LESS ROWS"
      : "LEGACY ASK THE RABBI IMPORT — BlogEntries(98) -> ask_the_rabbi",
    opts,
    target
  );

  if (repairMode) {
    await repair(opts, target);
    return;
  }

  // ---------------------------------------------------------------- read
  const pool = await connectLegacy("FrumShared");
  const entries: Entry[] = (
    await pool.request().query(`
      SELECT BlogEntryID, BlogEntryTitle, BlogEntryText, BlogEntryDate
      FROM BlogEntries
      WHERE BlogCategoryID = ${ATR_CATEGORY} AND Active = 1
      ORDER BY BlogEntryDate, BlogEntryID`)
  ).recordset;
  await pool.close();
  console.log(`Read ${entries.length} active legacy questions.`);

  const existingRows = (await target.sql.query(
    `SELECT id, question_number, title, question, answer FROM ask_the_rabbi`
  )) as ExistingRow[];
  const importedIds = (await target.sql.query(
    `SELECT old_blog_entry_id FROM ask_the_rabbi WHERE old_blog_entry_id IS NOT NULL`
  )) as { old_blog_entry_id: number }[];

  const already = new Set(importedIds.map((r) => r.old_blog_entry_id));
  console.log(`Already imported: ${already.size}`);

  let pending = entries.filter((e) => !already.has(e.BlogEntryID));
  if (opts.limit) pending = pending.slice(0, opts.limit);
  console.log(`Missing from the site: ${pending.length}\n`);

  // Occupancy map of every number currently in use, kept current as we place
  // rows so two incoming questions cannot be handed the same slot.
  const occupied = new Map<number, string>();
  for (const r of existingRows) {
    if (r.question_number != null) occupied.set(r.question_number, `live row ${r.id}`);
  }
  const existingByNumber = new Map<number, ExistingRow>();
  for (const r of existingRows) {
    if (r.question_number != null) existingByNumber.set(r.question_number, r);
  }

  // ------------------------------------------------------------- classify
  const inserts: Insert[] = [];
  const skips: Skip[] = [];
  const renumbers: Renumber[] = [];
  const similarityLog: string[] = [];
  // Incoming rows already placed, so a second copy in the same batch is caught.
  const placedByNumber = new Map<number, Insert>();
  let unnumbered = 0;

  for (const e of pending) {
    const title = htmlToLine(e.BlogEntryTitle);
    const body = htmlToText(e.BlogEntryText);
    const publishedAt = oleToTimestamp(e.BlogEntryDate);

    if (!body || body.length < 10) {
      skips.push({ oldId: e.BlogEntryID, title, why: "empty body" });
      continue;
    }
    if (!publishedAt) {
      skips.push({ oldId: e.BlogEntryID, title, why: "unparseable BlogEntryDate" });
      continue;
    }

    const { question, answer } = splitQuestionAnswer(body);
    if (!question || question.length < 10) {
      skips.push({ oldId: e.BlogEntryID, title, why: "no usable question text" });
      continue;
    }

    const num = extractQuestionNumber(title);
    if (num == null) unnumbered++;

    const row: Insert = {
      oldId: e.BlogEntryID,
      questionNumber: num,
      title: fit(title || question.slice(0, 80), 255),
      question,
      answer,
      publishedAt,
    };

    if (num == null) {
      // UNIQUE permits many NULLs, so an unnumbered row can never collide.
      inserts.push(row);
      continue;
    }

    // --- does this number already belong to something?
    const liveClash = existingByNumber.get(num);
    const batchClash = placedByNumber.get(num);
    const rival = batchClash
      ? { text: `${batchClash.question} ${batchClash.answer ?? ""}`, what: `incoming #${batchClash.oldId}` }
      : liveClash
        ? { text: `${liveClash.question} ${liveClash.answer ?? ""}`, what: `live row ${liveClash.id}` }
        : null;

    if (!rival) {
      occupied.set(num, `incoming #${e.BlogEntryID}`);
      placedByNumber.set(num, row);
      inserts.push(row);
      continue;
    }

    const score = bodySimilarity(`${question} ${answer ?? ""}`, rival.text);
    similarityLog.push(
      `  #${num} src ${String(e.BlogEntryID).padEnd(6)} vs ${rival.what.padEnd(18)} similarity ${score.toFixed(3)}  ${score >= DUPLICATE_THRESHOLD ? "DUPLICATE -> skip" : "DIFFERENT -> renumber"}  "${title.slice(0, 42)}"`
    );

    if (score >= DUPLICATE_THRESHOLD) {
      skips.push({
        oldId: e.BlogEntryID,
        title,
        why: "same question already present",
        detail: `${rival.what}, similarity ${score.toFixed(3)}`,
      });
      continue;
    }

    // --- genuine misnumbering: place directly above, shift the block up.
    const insertAt = num + 1;
    let firstFree = insertAt;
    while (occupied.has(firstFree)) firstFree++;

    // Shift descending so each row moves into an already-vacated slot.
    for (let n = firstFree - 1; n >= insertAt; n--) {
      const live = existingByNumber.get(n);
      if (live) {
        const nextTitle = renumberTitle(live.title, n + 1);
        if (nextTitle === live.title) {
          throw new Error(
            `Row ${live.id} title "${live.title}" has no #${n} to rewrite — refusing to renumber it, ` +
              `the column and the title would then disagree.`
          );
        }
        renumbers.push({ id: live.id, from: n, to: n + 1, titleFrom: live.title, titleTo: nextTitle });
        existingByNumber.set(n + 1, { ...live, question_number: n + 1, title: nextTitle });
        existingByNumber.delete(n);
      } else {
        const placed = placedByNumber.get(n);
        if (placed) {
          placed.renumberedFrom = placed.questionNumber ?? undefined;
          placed.questionNumber = n + 1;
          placed.title = renumberTitle(placed.title, n + 1);
          placedByNumber.set(n + 1, placed);
          placedByNumber.delete(n);
        }
      }
      occupied.set(n + 1, occupied.get(n) ?? "shifted");
      occupied.delete(n);
    }

    row.renumberedFrom = num;
    row.questionNumber = insertAt;
    row.title = fit(renumberTitle(row.title, insertAt), 255);
    occupied.set(insertAt, `incoming #${e.BlogEntryID}`);
    placedByNumber.set(insertAt, row);
    inserts.push(row);
  }

  // ------------------------------------------------------------ the plan
  console.log("PLAN");
  console.log(`  insert     : ${inserts.length}`);
  console.log(`  skip       : ${skips.length}`);
  console.log(`  renumber   : ${renumbers.length} live rows (column + title)`);
  console.log(`  unnumbered : ${unnumbered} incoming rows have no "#NNNN" in the title`);
  console.log(`               (left NULL, matching the rows already in the archive)`);

  if (similarityLog.length) {
    console.log("\nNUMBER COLLISIONS — every one scored, none hardcoded:");
    similarityLog.forEach((l) => console.log(l));
  }

  if (renumbers.length) {
    console.log(`\nRENUMBER CASCADE (${renumbers.length} live rows, applied top-down):`);
    for (const r of renumbers) {
      console.log(`  row ${String(r.id).padEnd(5)} ${r.from} -> ${r.to}`);
      console.log(`     "${r.titleFrom}"`);
      console.log(`  -> "${r.titleTo}"`);
    }
  }

  const moved = inserts.filter((i) => i.renumberedFrom != null);
  if (moved.length) {
    console.log("\nINCOMING ROWS PLACED ON A NEW NUMBER:");
    for (const m of moved) {
      console.log(`  src ${m.oldId}: #${m.renumberedFrom} -> #${m.questionNumber}  "${m.title}"`);
    }
  }

  if (skips.length) {
    console.log(`\nSKIPPED (${skips.length}):`);
    for (const s of skips) {
      console.log(`  src ${String(s.oldId).padEnd(6)} ${s.why}${s.detail ? ` (${s.detail})` : ""}`);
      console.log(`     "${s.title}"`);
    }
  }

  console.log("\nSAMPLE OF WHAT WILL BE INSERTED (newest 3):");
  for (const i of inserts.slice(-3)) {
    console.log(`  #${i.questionNumber ?? "(none)"} ${i.publishedAt.toISOString().slice(0, 10)} "${i.title}"`);
    console.log(`     Q: ${i.question.replace(/\n/g, " ").slice(0, 110)}`);
    console.log(`     A: ${(i.answer ?? "(no answer marker found)").replace(/\n/g, " ").slice(0, 110)}`);
  }

  // The byline is copied from what the existing archive actually carries rather
  // than hardcoded, so the 312 new rows match their neighbours.
  const bylines = (await target.sql.query(
    `SELECT answered_by, count(*)::int AS n FROM ask_the_rabbi
     WHERE old_blog_entry_id IS NOT NULL AND answered_by IS NOT NULL
     GROUP BY answered_by ORDER BY n DESC LIMIT 5`
  )) as { answered_by: string; n: number }[];
  console.log("\nBYLINE — matching the existing imported rows:");
  bylines.forEach((b) => console.log(`  ${b.n.toString().padStart(5)}  "${b.answered_by}"`));
  const byline = bylines[0]?.answered_by ?? null;
  if (!byline) console.log("  (none found — new rows will get NULL)");

  // The one corrupted live value, reported whether or not it is fixable.
  const entityRow = existingRows.find((r) => r.id === ENTITY_BUG_ROW.id);
  const correctFree = !occupied.has(ENTITY_BUG_ROW.correct);
  console.log("\nENTITY-BUG ROW:");
  if (!entityRow) {
    console.log(`  row ${ENTITY_BUG_ROW.id} not found — nothing to fix`);
  } else if (entityRow.question_number !== ENTITY_BUG_ROW.wrong) {
    console.log(`  row ${ENTITY_BUG_ROW.id} already holds ${entityRow.question_number} — nothing to fix`);
  } else if (!correctFree) {
    console.log(
      `  row ${ENTITY_BUG_ROW.id} holds ${ENTITY_BUG_ROW.wrong}, but ${ENTITY_BUG_ROW.correct} is taken by ${occupied.get(ENTITY_BUG_ROW.correct)} — LEFT ALONE`
    );
  } else {
    console.log(
      `  row ${ENTITY_BUG_ROW.id} "${entityRow.title}": ${ENTITY_BUG_ROW.wrong} -> ${ENTITY_BUG_ROW.correct}`
    );
  }
  const fixEntityRow =
    !!entityRow && entityRow.question_number === ENTITY_BUG_ROW.wrong && correctFree;

  if (!opts.commit) {
    console.log("\nDRY RUN — nothing written. Re-run with --commit to apply.");
    return;
  }
  if (!inserts.length && !renumbers.length && !fixEntityRow) {
    console.log("\nNothing to do.");
    return;
  }

  // ---------------------------------------------------------------- write
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join("scripts", "legacy-import", `atr-renumber-backup-${stamp}.json`);
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        takenAt: new Date().toISOString(),
        target: target.host,
        note: "Pre-change values. To revert: restore question_number and title for each row.",
        entityBugRow: fixEntityRow ? entityRow : null,
        renumbered: renumbers.map((r) => ({
          id: r.id,
          question_number: r.from,
          title: r.titleFrom,
        })),
      },
      null,
      2
    )
  );
  console.log(`\nSnapshot written: ${backupPath}`);

  // DESCENDING. Each row moves into a slot vacated by the row above it; going
  // the other way collides with UNIQUE(question_number) on the second write.
  const ordered = [...renumbers].sort((a, b) => b.from - a.from);
  console.log(`Renumbering ${ordered.length} live rows (descending)...`);
  for (const r of ordered) {
    await target.sql.query(
      `UPDATE ask_the_rabbi SET question_number = $1, title = $2 WHERE id = $3 AND question_number = $4`,
      [r.to, r.titleTo, r.id, r.from]
    );
  }

  if (fixEntityRow) {
    await target.sql.query(
      `UPDATE ask_the_rabbi SET question_number = $1 WHERE id = $2 AND question_number = $3`,
      [ENTITY_BUG_ROW.correct, ENTITY_BUG_ROW.id, ENTITY_BUG_ROW.wrong]
    );
    console.log(`Fixed row ${ENTITY_BUG_ROW.id}: ${ENTITY_BUG_ROW.wrong} -> ${ENTITY_BUG_ROW.correct}`);
  }

  console.log(`Inserting ${inserts.length} questions...`);
  let done = 0;
  for (const i of inserts) {
    await target.sql.query(
      `INSERT INTO ask_the_rabbi
         (question_number, title, question, answer, answered_by,
          is_published, published_at, old_blog_entry_id)
       VALUES ($1, $2, $3, $4, $5, true, $6, $7)`,
      [i.questionNumber, i.title, i.question, i.answer, byline, i.publishedAt, i.oldId]
    );
    done++;
    if (done % 50 === 0) console.log(`  ${done}/${inserts.length}`);
  }

  const [after] = (await target.sql.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE old_blog_entry_id IS NOT NULL)::int AS imported
     FROM ask_the_rabbi`
  )) as { total: number; imported: number }[];
  console.log(`\nDONE. ask_the_rabbi now holds ${after.total} rows (${after.imported} imported).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
