import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import type { ApprovalStatus } from "@/lib/submissions/statuses";
import { SUBMISSION_TYPES, type SubmissionType } from "@/lib/submissions/types";

/**
 * The status a submission lands on, for BOTH creating and editing.
 *
 * One helper on purpose. The spec's reason for sharing it is that create and
 * edit must not drift: the already-merged `applyEventEdit` set `pending`
 * unconditionally, so an admin or trusted user editing their own live event
 * self-unpublished it and had to ask someone else to restore it. The create
 * path had the rule right; the edit path never loaded the user row at all, so
 * it could not have known.
 *
 * `previousStatus` is null for a create.
 */
export async function resolveApprovalStatus(
  type: SubmissionType,
  userId: number,
  role: string | undefined,
  previousStatus: string | null
): Promise<ApprovalStatus> {
  // Checked BEFORE the auto-approve flag, deliberately. A rejection is an
  // admin's decision; letting an auto-approver overturn it by editing would
  // make the reject button advisory.
  if (previousStatus === "rejected") return "pending";

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const canAutoApprove =
    role === "admin" || Boolean(user?.[SUBMISSION_TYPES[type].autoApproveField]);

  if (canAutoApprove) return "approved";

  // `pending_edit` is sticky. Decaying a second edit back to `pending` would
  // make the eventual approval look like a first approval to every broadcast
  // guard — so pressing Save twice would re-email the whole subscriber list.
  return previousStatus === "approved" || previousStatus === "pending_edit"
    ? "pending_edit"
    : "pending";
}
