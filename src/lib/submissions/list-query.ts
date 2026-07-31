import { desc, eq } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
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
  approvalStatus: string;
  rejectionReason: string | null;
  isPast: boolean;
  canEdit: boolean;
  createdAt: string | null;
  editHref: string | null;
  publicHref: string | null;
}

type AnyTable = PgTable & Record<string, PgColumn>;

/**
 * Today, where the SITE is — never where the server is.
 *
 * A `date` column holds a calendar day with no timezone, so "is it past" has to
 * be asked against Toronto's day. On a UTC server (what Vercel runs) a
 * comparison against the process clock flips over at 7 or 8pm Toronto time and
 * marks today's shiva notice as finished.
 */
function torontoToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

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

  const value = row[config.pastBasis];
  if (value == null) return false;

  if (typeof value === "string") {
    // A DATE column, which Drizzle hands back as "YYYY-MM-DD". Lexicographic
    // comparison is correct for that format and avoids parsing it into an
    // instant, which is what shifts it a day.
    return value < torontoToday(now);
  }

  return value instanceof Date ? value.getTime() < now.getTime() : false;
}

async function loadType(
  type: SubmissionType,
  userId: number,
  role: string | undefined,
  now: Date
): Promise<Submission[]> {
  const config = SUBMISSION_TYPES[type];
  const table = config.table as AnyTable;

  const rows = (await db
    .select()
    .from(table)
    .where(eq(table[config.ownerColumn], userId))
    .orderBy(desc(table.id))) as unknown as Record<string, unknown>[];

  return Promise.all(
    rows.map(async (row) => {
      const isPast = isRowPast(config, row, now);
      const approvalStatus = (row.approvalStatus as string | null) ?? "pending";

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
