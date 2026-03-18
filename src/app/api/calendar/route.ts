import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { events, shuls } from "@/lib/db/schema";
import { eq, and, gte, lte, asc } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const upcoming = searchParams.get("upcoming");

    const conditions = [eq(events.approvalStatus, "approved")];

    // Filter by event type
    if (type) {
      conditions.push(eq(events.eventType, type));
    }

    // Filter by month/year
    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      conditions.push(gte(events.startTime, startDate));
      conditions.push(lte(events.startTime, endDate));
    }

    // Filter upcoming events only
    if (upcoming === "true") {
      conditions.push(gte(events.startTime, new Date()));
    }

    const results = await db
      .select({
        id: events.id,
        title: events.title,
        description: events.description,
        location: events.location,
        startTime: events.startTime,
        endTime: events.endTime,
        isAllDay: events.isAllDay,
        eventType: events.eventType,
        shulId: events.shulId,
        shulName: shuls.name,
        contactName: events.contactName,
        contactEmail: events.contactEmail,
        contactPhone: events.contactPhone,
        cost: events.cost,
        imageUrl: events.imageUrl,
      })
      .from(events)
      .leftJoin(shuls, eq(events.shulId, shuls.id))
      .where(and(...conditions))
      .orderBy(asc(events.startTime));

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}
