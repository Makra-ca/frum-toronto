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
 * On admins: there is no blanket pass for rows with NO shul link — an admin
 * editing someone else's simcha through the user-facing route is refused, and
 * acts through the admin routes instead. Rows that ARE shul-linked are a
 * different matter: canUserManageShul returns true for any admin on any shul,
 * so an admin can edit those here. That is intentional in that helper and not
 * worth diverging from, but it is not the same as "admins get nothing".
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

/**
 * Does this user manage the shul this row belongs to?
 *
 * Distinct from `canEditRow`, which is satisfied by ownership alone. This asks
 * the narrower question: is their authority here INSTITUTIONAL — are they
 * acting as the shul, rather than as the person who happened to post?
 *
 * That distinction earns them one thing and nothing more: their correction to
 * the shul's own event does not take it off the calendar. It does not let them
 * publish, because publishing an event emails every community-events
 * subscriber and there is no such thing as "this shul's followers".
 */
export async function managesRowShul(
  type: SubmissionType,
  row: Record<string, unknown>,
  userId: number,
  role: string | undefined
): Promise<boolean> {
  const config = SUBMISSION_TYPES[type];
  if (!config.shulColumn) return false;

  const linkedShulId = row[config.shulColumn];
  if (typeof linkedShulId !== "number") return false;

  return canUserManageShul(userId, linkedShulId, role ?? "");
}
