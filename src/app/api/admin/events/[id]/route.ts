import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { eventSchema } from "@/lib/validations/content";
import { eq } from "drizzle-orm";
import { sendEventLiveEmail } from "@/lib/email/send";

export const dynamic = "force-dynamic";

// GET /api/admin/events/[id] - Get single event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const eventId = parseInt(id);

    if (isNaN(eventId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json(
      { error: "Failed to fetch event" },
      { status: 500 }
    );
  }
}

// Shared update handler used by both PUT and PATCH
async function handleUpdate(request: NextRequest, eventId: number) {
  // Check if event exists and get current approvalStatus
  const [existingEvent] = await db
    .select({ approvalStatus: events.approvalStatus })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!existingEvent) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const body = await request.json();

  // Extract approvalStatus separately — it's not part of eventSchema
  const { approvalStatus, ...rest } = body;
  const validatedData = eventSchema.parse(rest);

  const updateValues: Record<string, unknown> = {
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
  };

  // If approvalStatus is provided, include it in the update
  if (approvalStatus !== undefined) {
    updateValues.approvalStatus = approvalStatus;
  }

  const [updatedEvent] = await db
    .update(events)
    .set(updateValues)
    .where(eq(events.id, eventId))
    .returning();

  // Trigger broadcast email when transitioning to "approved" for the first time
  const wasApproved = existingEvent.approvalStatus === "approved";
  const isNowApproved = (approvalStatus ?? existingEvent.approvalStatus) === "approved";

  if (!wasApproved && isNowApproved) {
    try {
      await sendEventLiveEmail(updatedEvent);
    } catch (emailError) {
      console.error("[EVENTS] Failed to send event live broadcast email on approval:", emailError);
    }
  }

  return NextResponse.json(updatedEvent);
}

// PUT /api/admin/events/[id] - Update event (full replace)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const eventId = parseInt(id);

    if (isNaN(eventId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    return await handleUpdate(request, eventId);
  } catch (error) {
    console.error("Error updating event:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid data", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/events/[id] - Update event (partial)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const eventId = parseInt(id);

    if (isNaN(eventId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    return await handleUpdate(request, eventId);
  } catch (error) {
    console.error("Error updating event:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid data", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/events/[id] - Delete event
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const eventId = parseInt(id);

    if (isNaN(eventId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Check if event exists
    const [existingEvent] = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!existingEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await db.delete(events).where(eq(events.id, eventId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting event:", error);
    return NextResponse.json(
      { error: "Failed to delete event" },
      { status: 500 }
    );
  }
}
