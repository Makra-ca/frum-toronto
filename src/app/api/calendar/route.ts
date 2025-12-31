import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { events, shuls, businesses } from "@/lib/db/schema";
import { eq, and, gte, lte, desc, asc, sql } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const upcoming = searchParams.get("upcoming");

    let query = db
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
        shulName: businesses.name,
        contactName: events.contactName,
        contactEmail: events.contactEmail,
        contactPhone: events.contactPhone,
        cost: events.cost,
        imageUrl: events.imageUrl,
      })
      .from(events)
      .leftJoin(shuls, eq(events.shulId, shuls.id))
      .leftJoin(businesses, eq(shuls.businessId, businesses.id))
      .where(eq(events.approvalStatus, "approved"))
      .$dynamic();

    // Filter by event type
    if (type) {
      query = query.where(eq(events.eventType, type));
    }

    // Filter by month/year
    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      query = query.where(
        and(
          gte(events.startTime, startDate),
          lte(events.startTime, endDate)
        )
      );
    }

    // Filter upcoming events only
    if (upcoming === "true") {
      query = query.where(gte(events.startTime, new Date()));
    }

    // Order by start time
    query = query.orderBy(asc(events.startTime));

    const results = await query;

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}
