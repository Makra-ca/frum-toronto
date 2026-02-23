import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tehillimList } from "@/lib/db/schema";
import { and, eq, lt, or, isNull } from "drizzle-orm";

// This cron job runs daily to delete expired tehillim entries
// Configure in vercel.json with: { "path": "/api/cron/tehillim-cleanup", "schedule": "0 0 * * *" }

export async function GET(request: Request) {
  try {
    // Verify cron secret in production
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date().toISOString().split("T")[0];

    // Delete expired tehillim entries that:
    // 1. Are not permanent (isPermanent is false or null)
    // 2. Have an expiration date that has passed
    const deleted = await db
      .delete(tehillimList)
      .where(
        and(
          // Not permanent (false or null)
          or(
            eq(tehillimList.isPermanent, false),
            isNull(tehillimList.isPermanent)
          ),
          // Has an expiration date and it has passed
          lt(tehillimList.expiresAt, today)
        )
      )
      .returning({ id: tehillimList.id });

    console.log(`[Cron] Tehillim cleanup: Deleted ${deleted.length} expired entries`);

    return NextResponse.json({
      success: true,
      deleted: deleted.length,
      date: today,
    });
  } catch (error) {
    console.error("[Cron] Tehillim cleanup error:", error);
    return NextResponse.json(
      { error: "Failed to cleanup tehillim entries" },
      { status: 500 }
    );
  }
}
