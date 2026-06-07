import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { events, users } from "@/lib/db/schema";
import { publicEventSchema } from "@/lib/validations/content";
import { and, eq, sql } from "drizzle-orm";
import { canUserManageShul } from "@/lib/auth/permissions";
import { sendEventLiveEmail, sendEventConflictNotificationEmail } from "@/lib/email/send";
import { notifyAdminOfSubmission } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// POST /api/community/events - Public event submission (requires auth)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be logged in to submit an event" },
        { status: 401 }
      );
    }

    const userId = parseInt(session.user.id);
    const userRole = session.user.role || "member";

    const body = await request.json();
    const result = publicEventSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const validatedData = result.data;
    const { forceSchedule = false } = validatedData;

    // If a shulId is provided, verify the user has permission to manage that shul
    if (validatedData.shulId && userRole !== "admin") {
      const canManage = await canUserManageShul(userId, validatedData.shulId, userRole);
      if (!canManage) {
        return NextResponse.json(
          { error: "You do not have permission to create events for this shul" },
          { status: 403 }
        );
      }
    }

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

    // Determine approval status
    const [dbUser] = await db
      .select({ canAutoApproveEvents: users.canAutoApproveEvents })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const isAdmin = userRole === "admin";
    const canAutoApprove = isAdmin || (dbUser?.canAutoApproveEvents ?? false);
    const approvalStatus = canAutoApprove ? "approved" : "pending";

    // Insert event
    const [newEvent] = await db
      .insert(events)
      .values({
        userId,
        title: validatedData.title,
        description: validatedData.description,
        location: validatedData.location,
        startTime: new Date(validatedData.startTime),
        endTime: validatedData.endTime ? new Date(validatedData.endTime) : null,
        isAllDay: validatedData.isAllDay,
        eventType: validatedData.eventType,
        shulId: validatedData.shulId ?? null,
        contactName: validatedData.contactName,
        contactEmail: validatedData.contactEmail || null,
        contactPhone: validatedData.contactPhone,
        cost: validatedData.cost,
        imageUrl: validatedData.imageUrl || null,
        flyerUrl: validatedData.flyerUrl || null,
        websiteUrl: validatedData.websiteUrl || null,
        organization: validatedData.organization,
        approvalStatus,
        isActive: true,
      })
      .returning();

    // Notify admins (Tier B: in-app only; digest picks up pending rows)
    await notifyAdminOfSubmission({
      contentType: "event",
      title: `New event submitted: ${validatedData.title}`,
      body:
        `${validatedData.title}\n` +
        `Starts: ${new Date(validatedData.startTime).toLocaleString("en-CA", { timeZone: "America/Toronto" })}\n` +
        `Submitted by: ${session.user.name || session.user.email || "Unknown user"}`,
      linkUrl: "/admin/programs/events",
      status: approvalStatus === "pending" ? "pending" : "auto_approved",
    });

    // If event is approved, send subscriber broadcast and conflict notifications
    if (approvalStatus === "approved") {
      // Send broadcast email to communityEvents subscribers
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

          for (const conflictEvent of conflictingEvents) {
            try {
              let recipientEmail = conflictEvent.contactEmail;
              if (!recipientEmail && conflictEvent.userId) {
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
    }

    const message = canAutoApprove
      ? "Your event has been published."
      : "Your event has been submitted for review.";

    return NextResponse.json(
      {
        event: { id: newEvent.id },
        message,
        autoApproved: canAutoApprove,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[EVENTS] Error creating event:", error);
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    );
  }
}
