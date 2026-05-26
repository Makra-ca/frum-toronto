import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/events/my-recent
// Returns the current user's last 5 created events for the "Copy from previous event" auto-fill
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);

    const recentEvents = await db
      .select({
        id: events.id,
        title: events.title,
        startTime: events.startTime,
        description: events.description,
        location: events.location,
        contactName: events.contactName,
        contactEmail: events.contactEmail,
        contactPhone: events.contactPhone,
        organization: events.organization,
        eventType: events.eventType,
      })
      .from(events)
      .where(eq(events.userId, userId))
      .orderBy(desc(events.createdAt))
      .limit(5);

    return NextResponse.json({ events: recentEvents });
  } catch (error) {
    console.error("[EVENTS] Error fetching recent events:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent events" },
      { status: 500 }
    );
  }
}
