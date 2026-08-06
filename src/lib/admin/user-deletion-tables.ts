/**
 * Which tables reference a user, and what happens to each on deletion.
 *
 * **Data only — this module must never import `@/lib/db`.** That module throws
 * without `DATABASE_URL`, and the vitest `unit` project runs without one, so a
 * single db import here would take every test that touches these constants with
 * it. The repo has hit this before (`SUBMISSION_TYPES.broadcast` is a lazy
 * import for exactly this reason).
 *
 * The split is also the right shape: the map is a fact about the schema and
 * worth testing on its own; the queries that use it are I/O.
 *
 * ## Measured against the live schema, 2026-08-06
 *
 * 31 foreign keys reference `users.id`:
 *
 * - **8 CASCADE** — removed with the user. Plumbing (sessions, accounts,
 *   notifications, subscriber row, …) with ONE exception: see ALWAYS_DESTROYED.
 * - **4 SET NULL** — row survives, reference cleared: `audit_log.actor_id`,
 *   `homepage_ads.submitted_by`, `page_views`, `search_queries`. Deliberate —
 *   the audit trail has to outlive the actor it records.
 * - **19 NO ACTION** — the delete FAILS. Those are OWNED_TABLES below, and they
 *   are why a plain delete button would just error on any real member.
 */

export type ReassignAction = "archive" | "null";

/**
 * `FrumToronto Archive` — `archive@frumtoronto.com`, a real account that already
 * owns 283 authorless imported posts. No password, no subscriber row: it cannot
 * be signed into and is never emailed. It exists only to own content.
 */
export const ARCHIVE_USER_ID = 3159;

/**
 * Every NO ACTION reference — everything that blocks a delete.
 *
 * `onReassign` is dictated by the column, not by taste. The two NOT NULL
 * columns cannot be cleared, so they move to the Archive account; the rest are
 * nullable and simply lose the reference.
 *
 * These identifiers are interpolated into SQL as raw text. They are module
 * constants and never request input, which is what makes that safe — nothing
 * user-supplied may ever be added to this list.
 */
export const OWNED_TABLES: ReadonlyArray<{
  table: string;
  column: string;
  label: string;
  onReassign: ReassignAction;
}> = [
  { table: "blog_posts", column: "author_id", label: "Blog posts", onReassign: "archive" },
  { table: "blog_comments", column: "author_id", label: "Blog comments", onReassign: "archive" },
  { table: "alerts", column: "user_id", label: "Alerts", onReassign: "null" },
  { table: "ask_the_rabbi_submissions", column: "user_id", label: "Ask the Rabbi questions", onReassign: "null" },
  { table: "ask_the_rabbi_submissions", column: "reviewed_by", label: "Ask the Rabbi reviews", onReassign: "null" },
  { table: "businesses", column: "user_id", label: "Businesses", onReassign: "null" },
  { table: "classifieds", column: "user_id", label: "Classifieds", onReassign: "null" },
  { table: "community_newsletters", column: "uploaded_by", label: "Community newsletters", onReassign: "null" },
  { table: "eruv_status", column: "updated_by", label: "Eruv updates", onReassign: "null" },
  { table: "events", column: "user_id", label: "Events", onReassign: "null" },
  { table: "kosher_alerts", column: "user_id", label: "Kosher alerts", onReassign: "null" },
  { table: "newsletters", column: "created_by", label: "Newsletters", onReassign: "null" },
  { table: "shiva_notifications", column: "user_id", label: "Shiva notices", onReassign: "null" },
  { table: "shul_documents", column: "uploaded_by", label: "Shul documents", onReassign: "null" },
  { table: "shul_registration_requests", column: "reviewed_by", label: "Shul request reviews", onReassign: "null" },
  { table: "simchas", column: "user_id", label: "Simchas", onReassign: "null" },
  { table: "specials", column: "user_id", label: "Specials", onReassign: "null" },
  { table: "tehillim_list", column: "user_id", label: "Tehillim names", onReassign: "null" },
  { table: "user_shuls", column: "assigned_by", label: "Shul manager assignments", onReassign: "null" },
];

/**
 * NOT NULL **and** CASCADE. The database destroys these before any of our code
 * runs, in every mode, and no foreign-key error stops it. Listed separately
 * because the honest thing is to warn rather than imply a choice exists.
 */
export const ALWAYS_DESTROYED = [
  { table: "ask_the_rabbi_comments", column: "author_id", label: "Ask the Rabbi comments" },
] as const;
