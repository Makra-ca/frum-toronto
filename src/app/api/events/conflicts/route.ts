import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

// GET /api/events/conflicts?date=YYYY-MM-DD
// Checks for approved events on the same calendar day (Eastern time)
export async function GET(request: NextRequest) {
  try {
    // Was unauthenticated. Both callers (the admin EventForm and the public
    // submission form) are behind a login, and submitting an event requires one
    // — so nothing legitimate loses access, while iterating ?date= over a year
    // to enumerate organisers stops being anonymous.
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
        // contactEmail deliberately NOT selected. EventConflictModal renders
        // only organization/contactName, so the address was returned to every
        // caller and displayed to none — a mailing list handed out one calendar
        // day at a time.
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
