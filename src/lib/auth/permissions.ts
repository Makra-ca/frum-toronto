import { db } from "@/lib/db";
import { userShuls } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Check if a user can manage a specific shul
 * Returns true if:
 * 1. User is an admin, OR
 * 2. User has role "shul" AND has an entry in userShuls for this shul
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

  // Non-shul users cannot manage shuls
  if (userRole !== "shul") {
    return false;
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
  // Non-shul users (except admin) cannot manage any shuls
  if (userRole !== "shul" && userRole !== "admin") {
    return [];
  }

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
