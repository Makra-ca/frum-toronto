import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// PATCH — mark a single notification as read or unread
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { isRead } = body as { isRead?: boolean };

    const userId = parseInt(session.user.id as string);
    const notificationId = parseInt(id);

    if (isNaN(notificationId)) {
      return NextResponse.json({ error: "Invalid notification id" }, { status: 400 });
    }

    await db
      .update(notifications)
      .set({ isRead: isRead !== undefined ? isRead : true })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        )
      );

    return NextResponse.json({ message: "Notification updated" });
  } catch (error) {
    console.error("[API] Error updating admin notification:", error);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}
