//
// The ONLY module that touches DailyLearning. That registry is module-level
// static state populated by a side-effect import, which is easy to get wrong in
// a way that fails silently (lookup returns null, nothing throws) — so it is
// isolated here behind a plain function.
import { HDate, DailyLearning } from "@hebcal/core";
// Bare side-effect import — it registers every schedule and exports nothing we
// use. The chain is: @hebcal/learning/index.js -> `import './register.js'` ->
// DailyLearning.addCalendar(...) per schedule.
//
// This LOOKS like something a bundler would tree-shake, which would blank the
// Daf Yomi column in production while every test still passed. It cannot:
// pruning a side-effect import requires the package to declare
// `"sideEffects": false`, and @hebcal/learning declares no `sideEffects` field
// at all, so bundlers must assume side effects and preserve it. Verified
// against the installed 6.9.7.
//
// If a future version adds that field, this needs a guard, because lookup()
// returns null BOTH when the registry is empty and when a date legitimately
// precedes the cycle — indistinguishable at the call site.
import "@hebcal/learning";

/**
 * Daf Yomi for a civil date, e.g. "Chullin 93" (hebcal's spelling; the old
 * FrumToronto sheet printed "Chulin").
 *
 * `date` must already be anchored (noon UTC) — see src/lib/zmanim-day.ts.
 *
 * Returns null before the cycle began, which the sheet renders as an empty cell
 * rather than a placeholder. Measured boundary: null through 1923-09-10, then
 * "Berachot 2" on 1923-09-11 — the cycle starts at daf 2 because daf 1 of a
 * tractate is the title page.
 */
export function dafYomiForDate(date: Date): string | null {
  const ev = DailyLearning.lookup("dafYomi", new HDate(date), false);
  // getDesc(), not render(): render("en") returns "Daf Yomi: Chullin 93" — the
  // prefix belongs in the column heading, not in every cell.
  return ev ? ev.getDesc() : null;
}
