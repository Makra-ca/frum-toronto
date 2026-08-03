import { db } from "@/lib/db";
import { userShuls } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Check if a user can manage a specific shul
 * Returns true if:
 * 1. User is an admin, OR
 * 2. User has an entry in userShuls for this shul
 *
 * The userShuls row is the authority, not the role. Rows can only be created by
 * an admin (admin/user-shuls POST and admin/shul-requests approve, both
 * admin-gated), so the assignment already encodes the grant. Requiring
 * role === "shul" on top of it meant an assignment silently did nothing for any
 * other role — which is what made the old unconditional "promote to shul"
 * necessary, and that in turn demoted admins.
 */
export async function canUserManageShul(
  userId: number,
  shulId: number,
  userRole: string
): Promise<boolean> {
  // Admins can manage any shul
  if (userRole === "admin") {
    return true;
  }

  // Check if user has assignment for this shul
  const assignment = await db
    .select()
    .from(userShuls)
    .where(and(eq(userShuls.userId, userId), eq(userShuls.shulId, shulId)))
    .limit(1);

  return assignment.length > 0;
}

/**
 * Get all shul IDs that a user can manage
 */
export async function getUserManagedShulIds(
  userId: number,
  userRole: string
): Promise<number[]> {
  // Driven by the assignments, not the role — see canUserManageShul. userRole
  // is kept in the signature for the callers that pass it, and because an
  // admin's managed set may later need to mean "all shuls" rather than "the
  // ones explicitly assigned".
  void userRole;

  const assignments = await db
    .select({ shulId: userShuls.shulId })
    .from(userShuls)
    .where(eq(userShuls.userId, userId));

  return assignments.map((a) => a.shulId);
}

/**
 * Check if user has any shul management permissions
 */
export async function hasAnyShulPermissions(
  userId: number,
  userRole: string
): Promise<boolean> {
  if (userRole === "admin") {
    return true;
  }

  if (userRole !== "shul") {
    return false;
  }

  const shulIds = await getUserManagedShulIds(userId, userRole);
  return shulIds.length > 0;
}
