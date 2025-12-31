import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { events, shuls, businesses } from "@/lib/db/schema";
import { eventSchema } from "@/lib/validations/content";
import { eq, desc } from "drizzle-orm";

// GET /api/admin/events - List all events
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // upcoming, past, all
    const eventType = searchParams.get("type");

    const query = db
      .select({
        id: events.id,
        title: events.title,
        description: events.description,
        location: events.location,
        startTime: events.startTime,
        endTime: events.endTime,
        isAllDay: events.isAllDay,
        eventType: events.eventType,
        contactName: events.contactName,
        contactEmail: events.contactEmail,
        contactPhone: events.contactPhone,
        cost: events.cost,
        imageUrl: events.imageUrl,
        approvalStatus: events.approvalStatus,
        isActive: events.isActive,
        createdAt: events.createdAt,
        shulId: events.shulId,
        shulName: businesses.name,
      })
      .from(events)
      .leftJoin(shuls, eq(events.shulId, shuls.id))
      .leftJoin(businesses, eq(shuls.businessId, businesses.id))
      .orderBy(desc(events.startTime));

    const allEvents = await query;

    // Filter by status
    let filteredEvents = allEvents;
    const now = new Date();

    if (status === "upcoming") {
      filteredEvents = allEvents.filter(
        (e) => new Date(e.startTime) >= now
      );
    } else if (status === "past") {
      filteredEvents = allEvents.filter(
        (e) => new Date(e.startTime) < now
      );
    }

    // Filter by event type
    if (eventType) {
      filteredEvents = filteredEvents.filter((e) => e.eventType === eventType);
    }

    return NextResponse.json(filteredEvents);
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}

// POST /api/admin/events - Create a new event
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = eventSchema.parse(body);

    const [newEvent] = await db
      .insert(events)
      .values({
        userId: parseInt(session.user.id),
        title: validatedData.title,
        description: validatedData.description,
        location: validatedData.location,
        startTime: new Date(validatedData.startTime),
        endTime: validatedData.endTime ? new Date(validatedData.endTime) : null,
        isAllDay: validatedData.isAllDay,
        eventType: validatedData.eventType,
        shulId: validatedData.shulId,
        contactName: validatedData.contactName,
        contactEmail: validatedData.contactEmail,
        contactPhone: validatedData.contactPhone,
        cost: validatedData.cost,
        imageUrl: validatedData.imageUrl,
        approvalStatus: "approved", // Admin-created events are auto-approved
        isActive: true,
      })
      .returning();

    return NextResponse.json(newEvent, { status: 201 });
  } catch (error) {
    console.error("Error creating event:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid data", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    );
  }
}
