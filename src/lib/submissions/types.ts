import type { PgTable } from "drizzle-orm/pg-core";
import {
  events,
  simchas,
  classifieds,
  kosherAlerts,
  alerts,
  shivaNotifications,
  tehillimList,
  blogPosts,
  users,
} from "@/lib/db/schema";

/**
 * Everything that differs per submission type, in one place, so nothing else
 * has to branch on type.
 *
 * Two fields carry real risk if set wrong:
 *
 *   detailKind  — `date` columns must render through formatDateOnly and
 *                 `timestamp` columns through formatInstant. Swap them and
 *                 every date-only row shows a day early. The test cross-checks
 *                 this against the actual Drizzle column type, so a wrong
 *                 value fails rather than shipping.
 *
 *   broadcast   — a LAZY import on purpose. @/lib/email/send pulls in
 *                 @/lib/db, which throws without DATABASE_URL, and that would
 *                 make this module unimportable from the DB-free unit project.
 */

export type SubmissionType =
  | "event"
  | "simcha"
  | "classified"
  | "kosherAlert"
  | "alert"
  | "shiva"
  | "tehillim"
  | "blog";

export interface SubmissionTypeConfig {
  label: string;
  table: PgTable;
  /** Column naming the submitter. A NULL value means the row is unowned. */
  ownerColumn: "userId" | "authorId";
  /**
   * Column linking the row to a shul, if any. Where present, content is
   * editable by whoever currently manages that shul — not only whoever posted
   * it, so a gabbai leaving does not strand the shul's own event.
   */
  shulColumn?: "shulId";
  titleColumn: string;
  /** The column shown as `detail`, stated explicitly — never inferred. */
  detailColumn: string;
  detailKind: "instant" | "date";
  /** Typed, so a typo fails to compile rather than silently never auto-approving. */
  autoApproveField: keyof typeof users.$inferSelect;
  /**
   * Columns deciding whether this is over, tried in order — the first
   * non-NULL one wins. null ⇒ no expiry concept, so never "past".
   *
   * Events list endTime first: a three-day event read from startTime alone
   * counts as finished on its opening night.
   */
  pastBasis: readonly string[] | null;
  /**
   * How to read pastBasis. DECLARED rather than inferred from the runtime
   * value: `typeof value === "string"` happens to identify a DATE column
   * today only because drizzle-orm/neon-http installs a raw parser for oid
   * 1082. It is the only driver that does — swap to neon-serverless (which
   * this project's own rules require the moment db.transaction() is needed)
   * and DATE columns arrive as Dates at LOCAL midnight, so a shiva notice
   * sitting today would read "past" before dawn. The test cross-checks this
   * against the real column type.
   */
  pastKind: "instant" | "date";
  /** A row where this boolean is true is never past, whatever the date says. */
  pastExemptField?: string;
  /** null ⇒ approving this type announces to nobody. */
  broadcast: (() => Promise<(row: never) => Promise<unknown>>) | null;
  editPath: (id: number) => string;
  publicPath: ((row: never) => string) | null;
}

export const SUBMISSION_TYPES: Record<SubmissionType, SubmissionTypeConfig> = {
  event: {
    label: "Event",
    table: events,
    ownerColumn: "userId",
    shulColumn: "shulId",
    titleColumn: "title",
    detailColumn: "startTime",
    detailKind: "instant",
    autoApproveField: "canAutoApproveEvents",
    // endTime first: a multi-day event is not over on its opening night, and
    // an all-day event is stored at noon, so reading startTime alone marks it
    // finished at 12:01 on the day it is running.
    pastBasis: ["endTime", "startTime"],
    pastKind: "instant",
    broadcast: async () =>
      (await import("@/lib/email/send")).sendEventLiveEmail as never,
    editPath: (id) => `/dashboard/submissions/events/${id}/edit`,
    publicPath: (row: never) =>
      `/community/calendar/${(row as { id: number }).id}`,
  },
  simcha: {
    label: "Simcha",
    table: simchas,
    ownerColumn: "userId",
    titleColumn: "familyName",
    detailColumn: "eventDate",
    detailKind: "date",
    autoApproveField: "canAutoApproveSimchas",
    pastBasis: null,
    pastKind: "date",
    broadcast: null,
    editPath: (id) => `/dashboard/submissions/simchas/${id}/edit`,
    publicPath: (row: never) => `/simchas/${(row as { id: number }).id}`,
  },
  classified: {
    label: "Classified",
    table: classifieds,
    ownerColumn: "userId",
    titleColumn: "title",
    detailColumn: "expiresAt",
    detailKind: "instant",
    autoApproveField: "canAutoApproveClassifieds",
    pastBasis: ["expiresAt"],
    pastKind: "instant",
    broadcast: null,
    editPath: (id) => `/dashboard/submissions/classifieds/${id}/edit`,
    publicPath: (row: never) => `/classifieds/${(row as { id: number }).id}`,
  },
  kosherAlert: {
    label: "Kosher alert",
    table: kosherAlerts,
    ownerColumn: "userId",
    titleColumn: "productName",
    detailColumn: "effectiveDate",
    detailKind: "date",
    autoApproveField: "canAutoApproveKosherAlerts",
    pastBasis: null,
    pastKind: "date",
    broadcast: async () =>
      (await import("@/lib/email/send")).sendKosherAlertBroadcast as never,
    editPath: (id) => `/dashboard/submissions/kosher-alerts/${id}/edit`,
    publicPath: null,
  },
  alert: {
    label: "Alert",
    table: alerts,
    ownerColumn: "userId",
    titleColumn: "title",
    detailColumn: "expiresAt",
    detailKind: "instant",
    autoApproveField: "canAutoApproveAlerts",
    pastBasis: ["expiresAt"],
    pastKind: "instant",
    broadcast: null,
    editPath: (id) => `/dashboard/submissions/alerts/${id}/edit`,
    publicPath: null,
  },
  shiva: {
    label: "Shiva notice",
    table: shivaNotifications,
    ownerColumn: "userId",
    titleColumn: "niftarName",
    detailColumn: "shivaEnd",
    detailKind: "date",
    autoApproveField: "canAutoApproveShiva",
    pastBasis: ["shivaEnd"],
    pastKind: "date",
    broadcast: async () =>
      (await import("@/lib/email/send")).sendShivaNoticeEmail as never,
    editPath: (id) => `/dashboard/submissions/shiva/${id}/edit`,
    publicPath: null,
  },
  tehillim: {
    label: "Tehillim",
    table: tehillimList,
    ownerColumn: "userId",
    titleColumn: "hebrewName",
    detailColumn: "expiresAt",
    detailKind: "date",
    autoApproveField: "canAutoApproveTehillim",
    pastBasis: ["expiresAt"],
    pastKind: "date",
    // A permanent entry never expires, so it is never past however old it is.
    pastExemptField: "isPermanent",
    broadcast: null,
    editPath: (id) => `/dashboard/submissions/tehillim/${id}/edit`,
    publicPath: null,
  },
  blog: {
    label: "Blog post",
    table: blogPosts,
    ownerColumn: "authorId",
    titleColumn: "title",
    detailColumn: "publishedAt",
    detailKind: "instant",
    autoApproveField: "canAutoApproveBlog",
    pastBasis: null,
    pastKind: "instant",
    broadcast: null,
    editPath: (id) => `/dashboard/blog/${id}/edit`,
    publicPath: (row: never) => `/blog/${(row as { slug: string }).slug}`,
  },
};
