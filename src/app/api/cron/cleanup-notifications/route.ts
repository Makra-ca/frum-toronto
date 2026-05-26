import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { lt } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET — delete notifications older than 30 days (called by Vercel cron)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db
      .delete(notifications)
      .where(lt(notifications.createdAt, thirtyDaysAgo));

    console.log("[CRON] Cleaned up expired notifications older than 30 days");

    return NextResponse.json({ message: "Notification cleanup completed" });
  } catch (error) {
    console.error("[CRON] Error cleaning up notifications:", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
