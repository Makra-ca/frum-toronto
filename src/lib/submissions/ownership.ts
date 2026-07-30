import { canUserManageShul } from "@/lib/auth/permissions";
import { SUBMISSION_TYPES, type SubmissionType } from "@/lib/submissions/types";

/**
 * May this user edit this row?
 *
 *     owner(row) = row.<ownerCol> === userId
 *                || (row.shulId != null && canUserManageShul(userId, row.shulId, role))
 *
 * Ownership is institutional where a shul is involved: content linked to a
 * shul is editable by whoever CURRENTLY manages it, not only by whoever
 * happened to post it. Personal-only ownership strands a shul whose gabbai
 * has left while the departed one keeps access.
 *
 * A NULL owner is never editable by anyone. Every legacy-imported row has one,
 * and they have no submitter who could own them.
 *
 * Note this deliberately does NOT hand admins a blanket pass on unlinked rows.
 * It guards the user-facing PATCH routes; admins act through the admin routes,
 * which have their own authorisation.
 */
export async function canEditRow(
  type: SubmissionType,
  row: Record<string, unknown>,
  userId: number,
  role: string | undefined
): Promise<boolean> {
  const config = SUBMISSION_TYPES[type];

  const owner = row[config.ownerColumn];
  if (typeof owner === "number" && owner === userId) return true;

  if (!config.shulColumn) return false;
  const linkedShulId = row[config.shulColumn];
  if (typeof linkedShulId !== "number") return false;

  // canUserManageShul takes a required string; session.user.role is
  // string | undefined, so it cannot be passed straight through.
  return canUserManageShul(userId, linkedShulId, role ?? "");
}
