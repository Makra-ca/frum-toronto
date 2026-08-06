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
 * Rows the person AUTHORED. Their own submissions.
 *
 * `purge` deletes these; `reassign` moves the two NOT NULL ones to the Archive
 * account and clears the rest. Either way the admin has seen them itemised in
 * the dialog first, so the choice is informed.
 */
export const CONTENT_TABLES: ReadonlyArray<OwnedTable> = [
  { table: "blog_posts", column: "author_id", label: "Blog posts", onReassign: "archive" },
  { table: "blog_comments", column: "author_id", label: "Blog comments", onReassign: "archive" },
  { table: "alerts", column: "user_id", label: "Alerts", onReassign: "null" },
  { table: "ask_the_rabbi_submissions", column: "user_id", label: "Ask the Rabbi questions", onReassign: "null" },
  { table: "businesses", column: "user_id", label: "Businesses", onReassign: "null" },
  { table: "classifieds", column: "user_id", label: "Classifieds", onReassign: "null" },
  { table: "events", column: "user_id", label: "Events", onReassign: "null" },
  { table: "kosher_alerts", column: "user_id", label: "Kosher alerts", onReassign: "null" },
  { table: "shiva_notifications", column: "user_id", label: "Shiva notices", onReassign: "null" },
  { table: "simchas", column: "user_id", label: "Simchas", onReassign: "null" },
  { table: "specials", column: "user_id", label: "Specials", onReassign: "null" },
  { table: "tehillim_list", column: "user_id", label: "Tehillim names", onReassign: "null" },
];

/**
 * Rows recording that this person ACTED ON something that is not theirs.
 *
 * **Never deleted, in any mode — only the reference is cleared.**
 *
 * The first version of this file put these in one list with the content above,
 * so `purge` ran `DELETE FROM eruv_status WHERE updated_by = ?` and friends.
 * That does not delete the user's content; it deletes:
 *
 *   - the community's entire eruv up/down history, because they updated it
 *   - somebody else's Ask the Rabbi question, because they reviewed it
 *   - a shul's newsletters and documents, because they uploaded them
 *   - **another user's shul-manager access**, via user_shuls.assigned_by
 *
 * Caught in review before it could fire (every such row is currently held by
 * the admin account, which deletion refuses). The distinction is not a nicety:
 * for content the dialog says "3 classifieds" and the admin can decide, but
 * "47 eruv updates" gives no hint that agreeing destroys community records. A
 * choice offered against a misleading label is not a choice.
 */
export const ATTRIBUTION_TABLES: ReadonlyArray<OwnedTable> = [
  { table: "ask_the_rabbi_submissions", column: "reviewed_by", label: "Ask the Rabbi reviews", onReassign: "null" },
  { table: "community_newsletters", column: "uploaded_by", label: "Community newsletters uploaded", onReassign: "null" },
  { table: "eruv_status", column: "updated_by", label: "Eruv updates", onReassign: "null" },
  { table: "newsletters", column: "created_by", label: "Newsletters created", onReassign: "null" },
  { table: "shul_documents", column: "uploaded_by", label: "Shul documents uploaded", onReassign: "null" },
  { table: "shul_registration_requests", column: "reviewed_by", label: "Shul requests reviewed", onReassign: "null" },
  { table: "user_shuls", column: "assigned_by", label: "Shul managers assigned", onReassign: "null" },
];

export interface OwnedTable {
  table: string;
  column: string;
  label: string;
  onReassign: ReassignAction;
}

/**
 * Both lists together — every NO ACTION reference, i.e. everything that blocks
 * a delete. Used where the question is "does anything point at this user at
 * all": the spam cohort, and the completeness test against the live schema.
 *
 * These identifiers are interpolated into SQL as raw text. They are module
 * constants and never request input, which is what makes that safe.
 */
export const OWNED_TABLES: ReadonlyArray<OwnedTable> = [
  ...CONTENT_TABLES,
  ...ATTRIBUTION_TABLES,
];

/**
 * NOT NULL **and** CASCADE. The database destroys these before any of our code
 * runs, in every mode, and no foreign-key error stops it. Listed separately
 * because the honest thing is to warn rather than imply a choice exists.
 */
export const ALWAYS_DESTROYED = [
  { table: "ask_the_rabbi_comments", column: "author_id", label: "Ask the Rabbi comments" },
] as const;
