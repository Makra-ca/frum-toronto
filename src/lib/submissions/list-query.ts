import { and, desc, eq, getTableColumns } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { ApprovalStatus } from "@/lib/submissions/statuses";
import { db } from "@/lib/db";
import { toDateInputValue } from "@/lib/datetime";
import { canEditRow } from "@/lib/submissions/ownership";
import {
  SUBMISSION_TYPES,
  type SubmissionType,
  type SubmissionTypeConfig,
} from "@/lib/submissions/types";

/**
 * Everything one user has submitted, across every type.
 *
 * Driven from SUBMISSION_TYPES, so adding a type is config rather than code.
 *
 * One query per type rather than a SQL UNION: the tables have different column
 * names and different column TYPES for the same idea (a simcha's event_date is
 * a DATE, an event's start_time is a timestamp), so a union would have to cast
 * them into a single shape and the cast is exactly where a date-only value
 * silently becomes a day earlier. Each type keeps its own type, and `detailKind`
 * tells the page which formatter to use.
 *
 * A user's own rows number in the hundreds at most, so the merge and sort run
 * in JS. That is also what makes a stable cross-type ordering possible at all.
 */

export interface Submission {
  id: number;
  type: SubmissionType;
  typeLabel: string;
  title: string;
  /** Raw value; the page formats it according to detailKind. */
  detail: string | null;
  detailKind: "instant" | "date";
  approvalStatus: ApprovalStatus;
  rejectionReason: string | null;
  isPast: boolean;
  canEdit: boolean;
  createdAt: string | null;
  editHref: string | null;
  publicHref: string | null;
}

type AnyTable = PgTable & Record<string, PgColumn>;

/**
 * Per type, per user. Someone with more than this has a bulk-import history
 * rather than a submissions list, and the page is not the tool for it.
 */
const MAX_ROWS_PER_TYPE = 200;

/**
 * The Toronto calendar day a basis value falls on, as "YYYY-MM-DD".
 *
 * Read by the DECLARED kind, never by the runtime type — see `pastKind`.
 *
 * A `date` column is a calendar day with no timezone, so it must be taken
 * verbatim; converting it through a timezone is what shifts it. A `timestamp`
 * is a real instant, so it converts to Toronto's day via the hardened helper
 * in datetime.ts (which builds the string from formatToParts rather than
 * trusting a locale's format pattern).
 */
function basisDay(value: unknown, kind: "instant" | "date"): string | null {
  if (value == null) return null;

  if (kind === "date") {
    // Under drizzle-orm/neon-http this is already "YYYY-MM-DD". Under a driver
    // that parses DATE into a Date, take the UTC parts — the driver builds it
    // from the stored y/m/d, so those parts are the stored day.
    if (typeof value === "string") return value.slice(0, 10);
    return value instanceof Date ? value.toISOString().slice(0, 10) : null;
  }

  if (value instanceof Date) return toDateInputValue(value);
  return typeof value === "string" ? toDateInputValue(value) : null;
}

/**
 * Is this over?
 *
 * Answered at DAY granularity, in Toronto, deliberately. An event running
 * today is not past at 12:01 in the afternoon — and an all-day event is stored
 * at noon Toronto, so an instant comparison marked it finished halfway through
 * the day it was running and took the submitter's Edit button with it.
 */
export function isRowPast(
  config: SubmissionTypeConfig,
  row: Record<string, unknown>,
  now: Date = new Date()
): boolean {
  // Four types have no expiry concept at all. An undated item is never past, so
  // nothing can silently disappear behind the "show past" toggle.
  if (!config.pastBasis) return false;

  // A permanent tehillim entry never expires, however old it is.
  if (config.pastExemptField && row[config.pastExemptField] === true) return false;

  // First non-NULL column wins: an event with an endTime is judged on when it
  // finishes, and falls back to when it starts.
  for (const column of config.pastBasis) {
    const day = basisDay(row[column], config.pastKind);
    if (day) return day < toDateInputValue(now);
  }

  return false;
}

async function loadType(
  type: SubmissionType,
  userId: number,
  role: string | undefined,
  now: Date
): Promise<Submission[]> {
  const config = SUBMISSION_TYPES[type];
  const table = config.table as AnyTable;

  // Only the columns this list needs. A plain select() pulled every column of
  // every row, which for a legacy blog author (1,395 posts on one account)
  // means serialising the full HTML body of each post into a dashboard
  // response — multiple megabytes to render a list of titles.
  const columns = getTableColumns(table) as Record<string, PgColumn>;
  const wanted: Record<string, PgColumn> = {
    id: columns.id,
    approvalStatus: columns.approvalStatus,
    rejectionReason: columns.rejectionReason,
    createdAt: columns.createdAt,
    [config.titleColumn]: columns[config.titleColumn],
    [config.detailColumn]: columns[config.detailColumn],
    ...(config.shulColumn ? { [config.shulColumn]: columns[config.shulColumn] } : {}),
    ...(config.pastExemptField
      ? { [config.pastExemptField]: columns[config.pastExemptField] }
      : {}),
    // canEditRow reads the owner, and publicPath may read a slug.
    [config.ownerColumn]: columns[config.ownerColumn],
    ...(columns.slug ? { slug: columns.slug } : {}),
  };
  for (const column of config.pastBasis ?? []) {
    wanted[column] = columns[column];
  }

  // A soft-deleted row is off the site, so listing it as "Live" with a link to
  // a page that 404s is worse than not listing it. shiva_notifications has no
  // isActive column, hence the guard rather than a blanket filter.
  const visible = columns.isActive
    ? and(eq(table[config.ownerColumn], userId), eq(columns.isActive, true))
    : eq(table[config.ownerColumn], userId);

  const rows = (await db
    .select(wanted)
    .from(table)
    .where(visible)
    .orderBy(desc(table.id))
    .limit(MAX_ROWS_PER_TYPE)) as unknown as Record<string, unknown>[];

  return Promise.all(
    rows.map(async (row) => {
      const isPast = isRowPast(config, row, now);
      // Typed as the union rather than string, so the page's status handling
      // stays exhaustive. A legacy row with an unrecognised value falls back
      // to pending, which is the safe direction — it shows as awaiting review
      // rather than as live.
      const approvalStatus = (row.approvalStatus as ApprovalStatus | null) ?? "pending";

      // Owner OR current shul manager, and not past. The list only ever holds
      // the caller's own rows, so canEditRow answers from the owner branch
      // without a further query — but it is called rather than reimplemented,
      // so the rule has one definition.
      const canEdit = !isPast && (await canEditRow(type, row, userId, role));

      const detail = row[config.detailColumn];

      return {
        id: row.id as number,
        type,
        typeLabel: config.label,
        title: String(row[config.titleColumn] ?? config.label),
        detail:
          detail == null
            ? null
            : detail instanceof Date
              ? detail.toISOString()
              : String(detail),
        detailKind: config.detailKind,
        approvalStatus,
        rejectionReason: (row.rejectionReason as string | null) ?? null,
        isPast,
        canEdit,
        createdAt:
          row.createdAt instanceof Date ? row.createdAt.toISOString() : null,
        editHref: canEdit ? config.editPath(row.id as number) : null,
        publicHref:
          approvalStatus === "approved" && config.publicPath
            ? config.publicPath(row as never)
            : null,
      } satisfies Submission;
    })
  );
}

export async function listSubmissions(
  userId: number,
  role: string | undefined,
  now: Date = new Date()
): Promise<Submission[]> {
  const types = Object.keys(SUBMISSION_TYPES) as SubmissionType[];

  const perType = await Promise.all(
    types.map((type) => loadType(type, userId, role, now))
  );

  return perType.flat().sort((a, b) => {
    // Newest first. The id tiebreaker is not decoration: imported content
    // shares created_at in bulk, and without it the order of equal timestamps
    // is whatever the database felt like, which changes between renders.
    const byDate = (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    if (byDate !== 0) return byDate;
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return b.id - a.id;
  });
}
