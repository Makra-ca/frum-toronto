import { applyEdit, SubmissionEditError } from "@/lib/submissions/apply-edit";
import type { ApprovalStatus } from "@/lib/submissions/statuses";

/**
 * Editing an event you submitted yourself.
 *
 * A thin wrapper over the generic `applyEdit`, kept only because the events
 * route and its tests were written against this name.
 *
 * It used to hold its own copy of the rules, and that copy drifted twice:
 *
 *  - it set `pending` unconditionally, silently revoking auto-approve and
 *    making a later re-approval look like a FIRST approval to every broadcast
 *    guard; and
 *  - it wrote `approval_status` directly, so an auto-approver's edit could
 *    publish an event without announcing it and without stamping
 *    `broadcast_at` — leaving the once-only guard unarmed on a live item, so a
 *    later approve/reject toggle would mass-email subscribers about something
 *    that had been public for weeks.
 *
 * Both are the same lesson: a second copy of this logic is a copy that drifts.
 */

export { SubmissionEditError as EventEditError };

export type EventEditInput = Record<string, unknown>;

export interface EventEditResult {
  id: number;
  /** The status the edit landed on, resolved the same way a create is. */
  status: ApprovalStatus;
  /** True when the edit pulled a live event off the calendar for re-review. */
  wasUnpublished: boolean;
}

export async function applyEventEdit(
  eventId: number,
  userId: number,
  input: EventEditInput,
  role?: string
): Promise<EventEditResult> {
  return applyEdit("event", eventId, userId, input, role);
}
