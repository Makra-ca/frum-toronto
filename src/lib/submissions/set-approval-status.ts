import { eq } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { notifySubmitter } from "@/lib/notifications";
import { formatDateOnly, formatInstant } from "@/lib/datetime";
import type { ApprovalStatus } from "@/lib/submissions/statuses";
import { SUBMISSION_TYPES, type SubmissionType } from "@/lib/submissions/types";

/**
 * The ONLY place an approval status is written.
 *
 * It owns three things that were previously spread across ~15 routes:
 * the transition, the broadcast decision, and the submitter notification.
 * Anything left off it silently notifies nobody, or silently re-broadcasts to
 * thousands.
 *
 * The broadcast rule is `next === "approved" && row.broadcastAt === null` —
 * at most one broadcast per item, ever. A transition-only rule
 * (`pending → approved`) is defeated by:
 *
 *     approved (broadcast) → edit → pending_edit → rejected → edit → pending → approve
 *
 * because `rejected` erases the fact that the row was ever published, so the
 * final approval looks like a first one. Publication is a fact about the ROW.
 * `pending_edit` remains as defence in depth, not as the sole guard.
 */

/** Drizzle's PgTable has no index signature; every in-scope table has these. */
type SubmissionTable = PgTable & {
  id: PgColumn;
  approvalStatus: PgColumn;
  broadcastAt: PgColumn;
  rejectionReason: PgColumn;
};

export interface SetApprovalStatusParams {
  type: SubmissionType;
  id: number;
  next: ApprovalStatus;
  /** Only meaningful when rejecting. Optional by decision. */
  rejectionReason?: string | null;
  /**
   * Written in the SAME update — e.g. tehillim's isPermanent on approval.
   * A second UPDATE would be a second chance to half-apply.
   */
  extraFields?: Record<string, unknown>;
}

export interface SetApprovalStatusResult {
  changed: boolean;
  previous: string | null;
  broadcast: boolean;
}

export async function setApprovalStatus(
  params: SetApprovalStatusParams
): Promise<SetApprovalStatusResult> {
  const { type, id, next, rejectionReason, extraFields } = params;
  const config = SUBMISSION_TYPES[type];
  const table = config.table as SubmissionTable;

  const [row] = await db
    .select()
    .from(table)
    .where(eq(table.id, id))
    .limit(1);

  if (!row) {
    return { changed: false, previous: null, broadcast: false };
  }

  const current = row as Record<string, unknown>;
  const previous = (current.approvalStatus as string | null) ?? null;
  const shouldBroadcast =
    next === "approved" && current.broadcastAt == null && config.broadcast !== null;

  const updates: Record<string, unknown> = {
    approvalStatus: next,
    // Cleared on any other transition, so an approved item never carries the
    // reason it was once turned down.
    rejectionReason: next === "rejected" ? rejectionReason ?? null : null,
    ...extraFields,
  };

  // Stamped in the same write as the status, BEFORE the send. If the send then
  // fails the announcement is lost, which is the safe direction: the opposite
  // ordering risks a crash between send and stamp re-emailing everyone on the
  // next approval.
  if (shouldBroadcast) updates.broadcastAt = new Date();

  await db.update(table).set(updates).where(eq(table.id, id));

  if (shouldBroadcast) {
    try {
      const [fresh] = await db.select().from(table).where(eq(table.id, id)).limit(1);
      const broadcaster = await config.broadcast!();
      if (fresh) await broadcaster(fresh as never);
    } catch (error) {
      console.error(`[NOTIFY] Broadcast failed for ${type} ${id}:`, error);
    }
  }

  // The submitter hears about the ADMIN's decisions only — never about their
  // own edit landing back in the queue.
  const ownerId = current[config.ownerColumn];
  if ((next === "approved" || next === "rejected") && typeof ownerId === "number") {
    await notifySubmitter({
      userId: ownerId,
      approved: next === "approved",
      typeLabel: config.label,
      itemTitle: String(current[config.titleColumn] ?? config.label),
      detail: formatDetail(current[config.detailColumn], config.detailKind),
      reason: rejectionReason,
      publicHref: config.publicPath ? config.publicPath(current as never) : null,
    });
  }

  return { changed: true, previous, broadcast: shouldBroadcast };
}

/**
 * A `date` column must render through formatDateOnly and a `timestamp` column
 * through formatInstant. Using the wrong one shifts a date-only value back a
 * day, which is exactly the production bug fixed on 2026-07-30.
 */
export function formatDetail(
  value: unknown,
  kind: "instant" | "date"
): string | null {
  if (value == null) return null;
  return kind === "date"
    ? formatDateOnly(value as string | Date)
    : formatInstant(value as Date);
}
