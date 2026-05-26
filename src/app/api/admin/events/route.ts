import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { events, shuls } from "@/lib/db/schema";
import { eventSchema } from "@/lib/validations/content";
import { eq, desc, ilike, or, and, gte, lt, sql } from "drizzle-orm";
import { sendEventLiveEmail } from "@/lib/email/send";

export const dynamic = "force-dynamic";

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
    const search = searchParams.get("search");

    // Build conditions array for SQL filtering
    const conditions = [];
    const now = new Date();

    // Filter by status (time-based)
    if (status === "upcoming") {
      conditions.push(gte(events.startTime, now));
    } else if (status === "past") {
      conditions.push(lt(events.startTime, now));
    }

    // Filter by event type
    if (eventType && eventType !== "all") {
      conditions.push(eq(events.eventType, eventType));
    }

    // Filter by search term
    if (search?.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(events.title, searchTerm),
          ilike(events.location, searchTerm),
          ilike(events.description, searchTerm),
          ilike(events.contactName, searchTerm),
          ilike(events.organization, searchTerm)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const allEvents = await db
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
        flyerUrl: events.flyerUrl,
        websiteUrl: events.websiteUrl,
        organization: events.organization,
        approvalStatus: events.approvalStatus,
        isActive: events.isActive,
        createdAt: events.createdAt,
        shulId: events.shulId,
        shulName: shuls.name,
      })
      .from(events)
      .leftJoin(shuls, eq(events.shulId, shuls.id))
      .where(whereClause)
      .orderBy(desc(events.startTime));

    return NextResponse.json(allEvents);
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
    const { forceSchedule = false, ...rest } = body;
    const validatedData = eventSchema.parse(rest);

    // Conflict check (unless forceSchedule is true)
    if (!forceSchedule && validatedData.startTime) {
      const startDate = new Date(validatedData.startTime);
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
            sql`DATE(${events.startTime} AT TIME ZONE 'America/Toronto') = DATE(${startDate.toISOString()} AT TIME ZONE 'America/Toronto')`
          )
        )
        .orderBy(events.startTime);

      if (conflictingEvents.length > 0) {
        return NextResponse.json({ conflicts: conflictingEvents }, { status: 200 });
      }
    }

    // Admin-created events are always approved
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
        contactEmail: validatedData.contactEmail || null,
        contactPhone: validatedData.contactPhone,
        cost: validatedData.cost,
        imageUrl: validatedData.imageUrl || null,
        flyerUrl: validatedData.flyerUrl || null,
        websiteUrl: validatedData.websiteUrl || null,
        organization: validatedData.organization,
        approvalStatus: "approved",
        isActive: true,
      })
      .returning();

    // Send subscriber broadcast email (admin-created events are always approved)
    try {
      await sendEventLiveEmail(newEvent);
    } catch (emailError) {
      console.error("[EVENTS] Failed to send event live broadcast email:", emailError);
    }

    // If force-scheduled, send conflict notification emails to other organizers
    if (forceSchedule && validatedData.startTime) {
      const startDate = new Date(validatedData.startTime);
      try {
        const conflictingEvents = await db
          .select({
            id: events.id,
            title: events.title,
            contactEmail: events.contactEmail,
            userId: events.userId,
          })
          .from(events)
          .where(
            and(
              eq(events.approvalStatus, "approved"),
              eq(events.isActive, true),
              sql`${events.id} != ${newEvent.id}`,
              sql`DATE(${events.startTime} AT TIME ZONE 'America/Toronto') = DATE(${startDate.toISOString()} AT TIME ZONE 'America/Toronto')`
            )
          );

        const { sendEventConflictNotificationEmail } = await import("@/lib/email/send");
        for (const conflictEvent of conflictingEvents) {
          try {
            // Use contactEmail if set, otherwise look up creator email
            let recipientEmail = conflictEvent.contactEmail;
            if (!recipientEmail && conflictEvent.userId) {
              const { users } = await import("@/lib/db/schema");
              const [creator] = await db
                .select({ email: users.email })
                .from(users)
                .where(eq(users.id, conflictEvent.userId))
                .limit(1);
              recipientEmail = creator?.email ?? null;
            }
            if (recipientEmail) {
              await sendEventConflictNotificationEmail(newEvent, recipientEmail);
            }
          } catch (notifyError) {
            console.error(`[EVENTS] Failed to send conflict notification to ${conflictEvent.contactEmail}:`, notifyError);
          }
        }
      } catch (conflictEmailError) {
        console.error("[EVENTS] Failed to send conflict notification emails:", conflictEmailError);
      }
    }

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
