import { and, eq, isNull } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { canEditRow, managesRowShul } from "@/lib/submissions/ownership";
import { resolveApprovalStatus } from "@/lib/submissions/auto-approve";
import { EDITABLE_FIELDS } from "@/lib/submissions/editable-fields";
import { setApprovalStatus } from "@/lib/submissions/set-approval-status";
import type { ApprovalStatus } from "@/lib/submissions/statuses";
import { SUBMISSION_TYPES, type SubmissionType } from "@/lib/submissions/types";

/**
 * A submitter editing their own content — for every type.
 *
 * One implementation rather than one per type. The six steps below are the
 * spec's mandatory list, and the reason they live here is that the events
 * version of this logic already drifted from the create path once: it set
 * `pending` unconditionally, which silently revoked auto-approve and, worse,
 * would have made the admin's re-approval look like a first approval to every
 * broadcast guard.
 *
 * Authentication and the verified-and-not-blocked gate (`assertCanPost`) are
 * the ROUTE's job — they need the session and a NextResponse. Everything below
 * is testable without HTTP.
 */

export class SubmissionEditError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "SubmissionEditError";
  }
}

export interface SubmissionEditResult {
  id: number;
  status: ApprovalStatus;
  /** True when the edit pulled something live off the site for re-review. */
  wasUnpublished: boolean;
}

type AnyTable = PgTable & Record<string, PgColumn>;

export async function applyEdit(
  type: SubmissionType,
  id: number,
  userId: number,
  input: Record<string, unknown>,
  role?: string
): Promise<SubmissionEditResult> {
  const config = SUBMISSION_TYPES[type];
  const table = config.table as AnyTable;

  const [existing] = (await db
    .select()
    .from(table)
    .where(eq(table.id, id))
    .limit(1)) as unknown as Record<string, unknown>[];

  if (!existing) {
    throw new SubmissionEditError("Not found", 404);
  }

  // Owner, or whoever currently manages the linked shul. A NULL owner — every
  // legacy-imported row — is editable by nobody.
  if (!(await canEditRow(type, existing, userId, role))) {
    throw new SubmissionEditError(
      "You can only edit things you submitted",
      403
    );
  }

  // Whitelist. A hostile client posting extra keys must not be able to
  // reassign the owner, set approvalStatus, or stamp broadcastAt.
  const updates: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS[type]) {
    if (field in input && input[field] !== undefined) {
      updates[field] = input[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new SubmissionEditError("No editable fields supplied", 400);
  }

  const previousStatus = (existing.approvalStatus as string | null) ?? null;
  let status = await resolveApprovalStatus(type, userId, role, previousStatus);

  // A shul's manager correcting that shul's own LIVE event keeps it live.
  //
  // Everything else they touch about their shul — davening times, address,
  // documents — goes live with no review, so having a typo fix take the shul's
  // event off the calendar was the odd one out with nothing on screen
  // explaining why.
  //
  // Narrow on purpose: only `approved → approved`. It cannot publish something
  // awaiting review, because publishing an event emails every community-events
  // subscriber, and there is no per-shul audience to send to instead.
  if (
    status === "pending_edit" &&
    previousStatus === "approved" &&
    (await managesRowShul(type, existing, userId, role))
  ) {
    status = "approved";
  }

  // Only true when the edit actually took something off the site. An
  // auto-approver's content stays live, and telling them otherwise is a lie
  // the UI then repeats back to them.
  const wasUnpublished = previousStatus === "approved" && status !== "approved";

  // The status is NOT written here. setApprovalStatus owns every transition,
  // and an edit can be a real publication: an auto-approver editing their own
  // pending item resolves to `approved`. Writing that directly skipped the
  // announcement, skipped stamping broadcast_at — leaving a live item with the
  // once-only guard unarmed, so a later approve/reject toggle mass-emailed
  // subscribers about something that had been public for weeks — and left a
  // stale rejection_reason on the row.
  //
  // The content write is conditional on the status read a few lines above.
  //
  // Be precise about what that does and does not buy. Both happen inside one
  // request, so it does NOT catch an admin who approves while the user has the
  // form open — that decision is already visible by the time we read, and the
  // edit proceeds against it, which is the behaviour we want anyway. What it
  // does catch is two writes racing each other: a double submit, two tabs, or
  // a retry after a client timeout where the first request actually landed.
  // Catching the form-open case needs the client to echo the version it
  // loaded; nothing sends one today.
  //
  // approvalStatus is nullable and `eq(col, null)` is never true in SQL, so a
  // NULL has to be matched with IS NULL or every legacy row 409s.
  const written = await db
    .update(table)
    .set(updates)
    .where(
      and(
        eq(table.id, id),
        previousStatus === null
          ? isNull(table.approvalStatus)
          : eq(table.approvalStatus, previousStatus)
      )
    )
    .returning({ id: table.id });

  if (written.length === 0) {
    throw new SubmissionEditError(
      "Someone reviewed this while you were editing. Reload the page to see its current state, then try again.",
      409
    );
  }

  // Content first, then the status, so anything the transition announces or
  // quotes carries the corrected text.
  if (status !== previousStatus) {
    await setApprovalStatus({ type, id, next: status });
  }

  return { id, status, wasUnpublished };
}
