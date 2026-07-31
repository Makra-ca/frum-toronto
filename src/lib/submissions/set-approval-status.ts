import { and, eq, isNull } from "drizzle-orm";
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
 * The broadcast rule is `next === "approved" && row.broadcastAt === null &&
 * previous !== "pending_edit"` — at most one broadcast per item, ever. The
 * stamp is the load-bearing half, because a transition-only rule
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

  // BOTH halves, deliberately:
  //
  //   broadcastAt == null       — publication is a fact about the row, which
  //                               survives a trip through `rejected`.
  //   previous !== pending_edit — the transition rule, kept as defence in
  //                               depth. A pending_edit row IS a correction to
  //                               something already published, so even if its
  //                               stamp were somehow missing (a row approved
  //                               before broadcast_at existed, a hand-edited
  //                               status) it must not announce.
  const shouldBroadcast =
    next === "approved" &&
    current.broadcastAt == null &&
    previous !== "pending_edit" &&
    config.broadcast !== null;

  const updates: Record<string, unknown> = {
    // extraFields FIRST, so it can never override the two fields this helper
    // exists to own. A caller reaching in with { approvalStatus } would
    // otherwise route around the single writer while appearing to use it.
    ...extraFields,
    approvalStatus: next,
    // Cleared on any other transition, so an approved item never carries the
    // reason it was once turned down.
    rejectionReason: next === "rejected" ? rejectionReason ?? null : null,
  };

  let didBroadcast = false;

  if (shouldBroadcast) {
    // The stamp is CLAIMED atomically: the write only lands where broadcast_at
    // is still NULL. Two admins pressing Approve at the same moment both read
    // NULL a moment earlier, so a read-then-write would let both send — and
    // what they are sending is an email to the entire subscriber list.
    //
    // Claiming before the send also means a crash mid-send loses the
    // announcement rather than repeating it, which is the safe direction.
    //
    // NOT covered by a test, deliberately: a Promise.all of two approvals
    // passes against the read-then-write version too, because neon-http sends
    // each query as its own round trip and the first finishes writing before
    // the second reads. A test that cannot fail on the broken code is worse
    // than none, so this guard rests on the SQL, which is where it belongs.
    const claimed = await db
      .update(table)
      .set({ ...updates, broadcastAt: new Date() })
      .where(and(eq(table.id, id), isNull(table.broadcastAt)))
      .returning();

    didBroadcast = claimed.length > 0;

    if (!didBroadcast) {
      // Lost the race. Still apply the status; just do not announce.
      await db.update(table).set(updates).where(eq(table.id, id));
    }
  } else {
    await db.update(table).set(updates).where(eq(table.id, id));
  }

  if (didBroadcast) {
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
  // `previous !== next` matters: the approve route is a button an admin can
  // press twice, and without this the submitter gets a second "your event is
  // live" email for a decision that did not change.
  const ownerId = current[config.ownerColumn];
  if (
    previous !== next &&
    (next === "approved" || next === "rejected") &&
    typeof ownerId === "number"
  ) {
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

  return { changed: true, previous, broadcast: didBroadcast };
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
