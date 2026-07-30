import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { publicEventSchema } from "@/lib/validations/content";
import { assertCanPost } from "@/lib/auth/require-verified";
import { notifyAdminOfSubmission } from "@/lib/notifications";
import { applyEventEdit, EventEditError } from "@/lib/events/edit-submission";
import { formatInstant } from "@/lib/datetime";

/** The submitter's own copy of an event, for populating the edit form. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const eventId = parseInt(id);
  if (Number.isNaN(eventId)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.userId === null || event.userId !== parseInt(session.user.id)) {
    return NextResponse.json(
      { error: "You can only edit events you submitted" },
      { status: 403 }
    );
  }

  return NextResponse.json(event);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = parseInt(id);
    if (Number.isNaN(eventId)) {
      return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Same gate as creating: verified and not blocked.
    const notAllowed = await assertCanPost(session.user.id);
    if (notAllowed) return notAllowed;

    const body = await request.json();
    const parsed = publicEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const result = await applyEventEdit(eventId, parseInt(session.user.id), {
      ...data,
      startTime: new Date(data.startTime),
      endTime: data.endTime ? new Date(data.endTime) : null,
    });

    await notifyAdminOfSubmission({
      contentType: "event",
      title: `Event edited by submitter: ${data.title}`,
      body:
        `${data.title}\n` +
        `Starts: ${formatInstant(data.startTime, { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}\n` +
        `Edited by: ${session.user.name || session.user.email || "Unknown user"}\n` +
        (result.wasUnpublished
          ? "This event was live and has been taken off the calendar pending re-approval."
          : "This event was already awaiting approval."),
      linkUrl: "/admin/programs/events",
      status: "pending",
      replyTo: session.user.email ?? undefined,
    });

    revalidatePath("/community/calendar");
    revalidatePath(`/community/calendar/${eventId}`);

    return NextResponse.json({
      ...result,
      message: result.wasUnpublished
        ? "Your changes were saved. The event has been removed from the calendar until an admin re-approves it."
        : "Your changes were saved. The event is still awaiting approval.",
    });
  } catch (error) {
    if (error instanceof EventEditError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("[API] Error editing event:", error);
    return NextResponse.json(
      { error: "Failed to save your changes" },
      { status: 500 }
    );
  }
}
