import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { publicEventSchema } from "@/lib/validations/content";
import { assertCanPost } from "@/lib/auth/require-verified";
import {
  notifyAdminOfSubmission,
  notifyAdminOfTrustedEdit,
} from "@/lib/notifications";
import { applyEventEdit, EventEditError } from "@/lib/events/edit-submission";
import { canEditRow } from "@/lib/submissions/ownership";
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

  // The SAME check PATCH runs. An owner-only check here meant a shul manager
  // was refused the form for an event they are allowed to save.
  const mayEdit = await canEditRow(
    "event",
    event,
    parseInt(session.user.id),
    session.user.role
  );

  if (!mayEdit) {
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
    const result = await applyEventEdit(
      eventId,
      parseInt(session.user.id),
      {
        ...data,
        startTime: new Date(data.startTime),
        endTime: data.endTime ? new Date(data.endTime) : null,
      },
      session.user.role
    );

    const editorName =
      session.user.name || session.user.email || "Unknown user";
    const stillLive = result.status === "approved";

    // Every branch below reads the RESOLVED status, not wasUnpublished. An
    // auto-approver's event never leaves the calendar, and both the admin
    // notification and the user-facing message used to say it had.
    await notifyAdminOfSubmission({
      contentType: "event",
      title: `Event edited by submitter: ${data.title}`,
      body:
        `${data.title}\n` +
        `Starts: ${formatInstant(data.startTime, { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}\n` +
        `Edited by: ${editorName}\n` +
        (result.wasUnpublished
          ? "This event was live and has been taken off the calendar pending re-approval."
          : stillLive
            ? "This event stayed live — the editor has auto-approve for events."
            : "This event was already awaiting approval."),
      linkUrl: "/admin/programs/events",
      status: stillLive ? "auto_approved" : "pending",
      replyTo: session.user.email ?? undefined,
    });

    // The spec's mitigation for letting auto-approvers' edits stay live:
    // someone could publish something innocuous and later edit it to anything,
    // unreviewed. In-app only, so there is a trail without inbox noise.
    if (stillLive) {
      await notifyAdminOfTrustedEdit({
        typeLabel: "Event",
        itemTitle: data.title,
        editorName,
        linkUrl: `/community/calendar/${eventId}`,
      });
    }

    revalidatePath("/community/calendar");
    revalidatePath(`/community/calendar/${eventId}`);

    return NextResponse.json({
      ...result,
      message: result.wasUnpublished
        ? "Your changes were saved. The event has been removed from the calendar until an admin re-approves it."
        : stillLive
          ? "Your changes were saved and the event is still on the calendar."
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
