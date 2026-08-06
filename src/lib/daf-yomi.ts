//
// The ONLY module that touches DailyLearning. That registry is module-level
// static state populated by a side-effect import, which is easy to get wrong in
// a way that fails silently (lookup returns null, nothing throws) — so it is
// isolated here behind a plain function.
import { HDate, DailyLearning } from "@hebcal/core";
import "@hebcal/learning";

/**
 * Daf Yomi for a civil date, e.g. "Chullin 93" (hebcal's spelling).
 *
 * `date` must already be anchored (noon UTC) — see src/lib/zmanim-day.ts.
 * Returns null before the Daf Yomi cycle began (1923), which the sheet renders
 * as an empty cell rather than a placeholder.
 */
export function dafYomiForDate(date: Date): string | null {
  const ev = DailyLearning.lookup("dafYomi", new HDate(date), false);
  // getDesc(), not render(): render("en") returns "Daf Yomi: Chullin 93" — the
  // prefix belongs in the column heading, not in every cell.
  return ev ? ev.getDesc() : null;
}
