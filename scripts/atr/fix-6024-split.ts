/**
 * Corrects the question/answer boundary on "6024 - Dance at the Right Wedding!"
 * (ask_the_rabbi id 5527).
 *
 *   npx tsx scripts/atr/fix-6024-split.ts            # dry run
 *   npx tsx scripts/atr/fix-6024-split.ts --commit
 *
 * The Rabbi's answer quotes an earlier Q&A, so the body contains "A." twice.
 * Whoever entered this from his 31 July email cut at the SECOND one, which left
 * the opening of the answer — and the older question it quotes — sitting inside
 * the question field. The page therefore shows part of the ruling under
 * "Question", followed by a dangling "A." under "Answer".
 *
 * This moves the boundary to the first marker and drops it, which is exactly
 * what every imported row does. Compare id 5838 (#6010), whose answer reads:
 *
 *   "On question 3251 we wrote:\n\nQ. Can one polish silver plates…\n\nA. Kovetz Halochos…"
 *
 * NO WORDS ARE ADDED, REMOVED OR REWORDED. The only characters that disappear
 * are the outer "\nA. " marker. The script asserts that character count below
 * and refuses to write if anything else moved.
 *
 * The row's bak_question / bak_answer columns were captured before this change,
 * so they hold the pre-fix text and this is reversible with:
 *   UPDATE ask_the_rabbi SET question = bak_question, answer = bak_answer WHERE id = 5527;
 */
import { announce, connectTarget, parseOptions } from "./../legacy-import/lib";

const ROW_ID = 5527;
/** The outer answer marker: newline, "A", ".", space. Dropped, as everywhere else. */
const MARKER = /\n\s*A\.\s*/;

async function main() {
  const opts = parseOptions();
  const target = connectTarget(opts.useTest);
  announce("ASK THE RABBI — fix the Q/A boundary on #6024 (id 5527)", opts, target);

  const [row] = (await target.sql.query(
    `SELECT id, title, question, answer FROM ask_the_rabbi WHERE id = $1`,
    [ROW_ID]
  )) as { id: number; title: string; question: string; answer: string }[];

  if (!row) throw new Error(`Row ${ROW_ID} not found.`);
  console.log(`Row ${row.id}: "${row.title}"\n`);

  const m = row.question.match(MARKER);
  if (!m || m.index === undefined) {
    console.log("No answer marker inside the question field — already fixed, or not the expected state.");
    console.log(`  question: ${JSON.stringify(row.question.slice(0, 120))}`);
    return;
  }

  const newQuestion = row.question.slice(0, m.index).trim();
  const movedText = row.question.slice(m.index + m[0].length).trim();
  // The existing answer already begins with the NESTED "A. " marker, which is
  // part of the quoted material and stays — matching id 5838 above.
  const newAnswer = `${movedText}\n\n${row.answer.trim()}`;

  console.log("BEFORE");
  console.log(`  Q (${row.question.length}): ${row.question.replace(/\n/g, " ⏎ ")}`);
  console.log(`  A (${row.answer.length}): ${row.answer.slice(0, 110).replace(/\n/g, " ⏎ ")}…`);
  console.log("\nAFTER");
  console.log(`  Q (${newQuestion.length}): ${newQuestion.replace(/\n/g, " ⏎ ")}`);
  console.log(`  A (${newAnswer.length}): ${newAnswer.slice(0, 110).replace(/\n/g, " ⏎ ")}…`);

  // ---- integrity: nothing may vanish except the outer marker itself.
  const strip = (s: string) => s.replace(/\s+/g, "");
  const beforeChars = strip(row.question) + strip(row.answer);
  const afterChars = strip(newQuestion) + strip(newAnswer);
  const dropped = beforeChars.length - afterChars.length;
  console.log(`\nINTEGRITY`);
  console.log(`  non-whitespace characters before : ${beforeChars.length}`);
  console.log(`  non-whitespace characters after  : ${afterChars.length}`);
  console.log(`  dropped                          : ${dropped}  (expected 2 — the "A." marker)`);

  if (dropped !== 2) {
    throw new Error(`REFUSING TO WRITE: ${dropped} characters would change, expected exactly 2.`);
  }
  if (!newQuestion.endsWith("?")) {
    throw new Error(`REFUSING TO WRITE: the question no longer ends with a question mark.`);
  }

  if (!opts.commit) {
    console.log("\nDRY RUN — nothing written. Re-run with --commit to apply.");
    return;
  }

  // Guarded on the exact prior text so a re-run cannot double-apply.
  const res = (await target.sql.query(
    `UPDATE ask_the_rabbi SET question = $1, answer = $2
      WHERE id = $3 AND question = $4 RETURNING id`,
    [newQuestion, newAnswer, ROW_ID, row.question]
  )) as { id: number }[];

  console.log(res.length ? `\n✅ Updated row ${res[0].id}.` : "\n⚠️  No row updated — text changed under us. Nothing written.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
