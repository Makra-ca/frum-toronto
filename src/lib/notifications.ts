import { db } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

interface NotificationPayload {
  userId: number;
  type: string;
  title: string;
  body?: string;
  linkUrl?: string;
}

/**
 * Creates a notification for a specific user.
 */
export async function createNotification(payload: NotificationPayload): Promise<void> {
  await db.insert(notifications).values({
    userId: payload.userId,
    type: payload.type,
    title: payload.title,
    body: payload.body ?? "",
    linkUrl: payload.linkUrl ?? null,
  });
}

/**
 * Creates a notification for ALL active admin users.
 */
export async function createAdminNotification(
  payload: Omit<NotificationPayload, "userId">
): Promise<void> {
  const adminUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true)));

  if (adminUsers.length === 0) return;

  await db.insert(notifications).values(
    adminUsers.map((admin) => ({
      userId: admin.id,
      type: payload.type,
      title: payload.title,
      body: payload.body ?? "",
      linkUrl: payload.linkUrl ?? null,
    }))
  );
}
