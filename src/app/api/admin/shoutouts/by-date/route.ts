import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businessShoutouts, businesses } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/admin/shoutouts/by-date - Get approved shoutout for a specific date
// Used by newsletter composer to check if a shoutout is booked
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "date query param is required in YYYY-MM-DD format" },
        { status: 400 }
      );
    }

    const [shoutout] = await db
      .select({
        id: businessShoutouts.id,
        businessId: businessShoutouts.businessId,
        businessName: businesses.name,
        contentHtml: businessShoutouts.contentHtml,
        contentJson: businessShoutouts.contentJson,
        imageUrl: businessShoutouts.imageUrl,
        status: businessShoutouts.status,
        scheduledDate: businessShoutouts.scheduledDate,
      })
      .from(businessShoutouts)
      .leftJoin(businesses, eq(businessShoutouts.businessId, businesses.id))
      .where(
        and(
          eq(businessShoutouts.scheduledDate, date),
          eq(businessShoutouts.status, "approved")
        )
      )
      .limit(1);

    return NextResponse.json({ shoutout: shoutout || null });
  } catch (error) {
    console.error("[Admin Shoutouts by-date] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch shoutout for date" },
      { status: 500 }
    );
  }
}
