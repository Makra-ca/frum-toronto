import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// POST /api/admin/events/check-conflict
// Body: { startDate: string (ISO or YYYY-MM-DD), eventId?: number }
// Returns: { conflicts: Event[] }
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { startDate, eventId } = body;

    if (!startDate) {
      return NextResponse.json({ error: "startDate is required" }, { status: 400 });
    }

    const date = new Date(startDate);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
    }

    const conditions = [
      eq(events.approvalStatus, "approved"),
      eq(events.isActive, true),
      sql`DATE(${events.startTime} AT TIME ZONE 'America/Toronto') = DATE(${date.toISOString()} AT TIME ZONE 'America/Toronto')`,
    ];

    // Exclude current event when editing
    if (eventId && !isNaN(Number(eventId))) {
      conditions.push(sql`${events.id} != ${Number(eventId)}`);
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
      .where(and(...conditions))
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
