// From the DB-free module, so this file stays importable without a database.
import { ARCHIVE_USER_ID } from "@/lib/admin/user-deletion-tables";

/**
 * Who may never be deleted, and why.
 *
 * Pure so the rules can be tested without a database — the same reason
 * `wouldRemoveLastAdmin` and `resolveBusinessApprovalStatus` are pure. Deletion
 * is irreversible, so these are the checks most worth pinning.
 */

export type DeletionRefusal =
  | { allowed: true }
  | { allowed: false; reason: string };

export interface DeletionTarget {
  targetId: number;
  targetRole: string | null;
  /** The admin performing the deletion. */
  actorId: number;
}

export function canDeleteUser({
  targetId,
  targetRole,
  actorId,
}: DeletionTarget): DeletionRefusal {
  if (targetId === actorId) {
    return {
      allowed: false,
      reason: "You cannot delete your own account.",
    };
  }

  if (targetRole === "admin") {
    // There is exactly ONE active admin, and no in-app recovery from losing it.
    // Blanket rather than last-admin-aware on purpose: unlike a demotion, this
    // cannot be undone by promoting someone else afterwards. Demote first, then
    // delete — two deliberate steps for an irreversible outcome.
    return {
      allowed: false,
      reason:
        "Admin accounts cannot be deleted. Change the role to member first if you really mean to remove this account.",
    };
  }

  if (targetId === ARCHIVE_USER_ID) {
    // Reassignment moves content TO this account. Deleting it is incoherent —
    // and it already owns 283 imported posts that have nowhere else to go.
    return {
      allowed: false,
      reason:
        "The FrumToronto Archive account owns imported content and is where other people's posts are reassigned. It cannot be deleted.",
    };
  }

  return { allowed: true };
}
