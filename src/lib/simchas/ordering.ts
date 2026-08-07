import { sql } from "drizzle-orm";
import { simchas } from "@/lib/db/schema";

/**
 * The order simchas are BROWSED in: newest simcha first.
 *
 * The page used to sort by `created_at` — the order things were typed in.
 * That broke the moment anyone caught up on a backlog: entering Pesach
 * announcements in August put them above the August ones, because they were
 * typed last. Thirteen rows in production are exactly that case.
 *
 * WHY COALESCE AND NOT PLAIN event_date
 * -------------------------------------
 * 16,542 imported rows have no `event_date` — the legacy site recorded only
 * when an announcement was POSTED. Postgres sorts `DESC` as NULLS FIRST, so a
 * plain `event_date DESC` would put the entire 2005–2010 archive at the top of
 * page one. Falling back to the post date keeps every undated row exactly
 * where it sits today.
 *
 * THE COST, STATED PLAINLY
 * ------------------------
 * One sort key then carries two meanings, so an undated recent post outranks
 * a dated older simcha. That is unavoidable while most rows are undated, and
 * it shrinks as dates get filled in — which is why the date is now required on
 * every path that creates a simcha.
 *
 * `created_at` is a timestamp and `event_date` a date, hence the cast: without
 * it Postgres has to pick a common type for COALESCE and the comparison stops
 * meaning what it reads like.
 */
export const simchaBrowseOrder = [
  sql`COALESCE(${simchas.eventDate}, ${simchas.createdAt}::date) DESC`,
  // Tiebreaker. Imported rows share timestamps in bulk and 13 rows share one
  // event_date, so without this OFFSET paging repeats and skips rows.
  sql`${simchas.id} DESC`,
];

/**
 * The order simchas are ANNOUNCED in: most recently posted first.
 *
 * Deliberately NOT the browse order. A newsletter answers "what is new since
 * the last one", so a simcha entered today belongs in today's newsletter even
 * if it happened in April. Sorting these by event date would bury every
 * backfilled announcement below older entries and it would never go out.
 */
export const simchaAnnounceOrder = sql`${simchas.createdAt} DESC`;
