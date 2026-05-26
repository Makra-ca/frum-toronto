import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/events/conflicts?date=YYYY-MM-DD
// Checks for approved events on the same calendar day (Eastern time)
// No auth required — used client-side before form submission
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }

    // Validate YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date must be in YYYY-MM-DD format" }, { status: 400 });
    }

    const conflictingEvents = await db
      .select({
        id: events.id,
        title: events.title,
        startTime: events.startTime,
        contactName: events.contactName,
        organization: events.organization,
        contactEmail: events.contactEmail,
      })
      .from(events)
      .where(
        and(
          eq(events.approvalStatus, "approved"),
          eq(events.isActive, true),
          sql`DATE(${events.startTime} AT TIME ZONE 'America/Toronto') = ${date}::date`
        )
      )
      .orderBy(events.startTime);

    return NextResponse.json({ conflicts: conflictingEvents });
  } catch (error) {
    console.error("[EVENTS] Error checking conflicts:", error);
    return NextResponse.json(
      { error: "Failed to check conflicts" },
      { status: 500 }
    );
  }
}
