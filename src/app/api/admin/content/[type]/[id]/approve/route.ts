import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { simchas, classifieds, events, tehillimList } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendEventLiveEmail } from "@/lib/email/send";

const tableMap = {
  simchas,
  classifieds,
  events,
  tehillim: tehillimList,
} as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { type, id } = await params;

    // Parse request body for additional options (like isPermanent for tehillim)
    let body = {};
    try {
      body = await request.json();
    } catch {
      // No body provided, which is fine
    }

    const table = tableMap[type as keyof typeof tableMap];
    if (!table) {
      return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
    }

    // For events: check previous approvalStatus so we can trigger email on transition
    let previousApprovalStatus: string | null = null;
    if (type === "events") {
      const [existing] = await db
        .select({ approvalStatus: events.approvalStatus })
        .from(events)
        .where(eq(events.id, parseInt(id)))
        .limit(1);
      previousApprovalStatus = existing?.approvalStatus ?? null;
    }

    // Base update object
    const updateData: Record<string, unknown> = {
      approvalStatus: "approved",
    };

    // For tehillim, handle isPermanent flag
    if (type === "tehillim" && "isPermanent" in body) {
      updateData.isPermanent = body.isPermanent;
      // If making permanent, clear the expiration date
      if (body.isPermanent) {
        updateData.expiresAt = null;
      }
    }

    await db
      .update(table)
      .set(updateData)
      .where(eq(table.id, parseInt(id)));

    // Trigger event live broadcast email when transitioning to approved
    if (type === "events" && previousApprovalStatus !== "approved") {
      try {
        const [approvedEvent] = await db
          .select()
          .from(events)
          .where(eq(events.id, parseInt(id)))
          .limit(1);

        if (approvedEvent) {
          await sendEventLiveEmail(approvedEvent);
        }
      } catch (emailError) {
        console.error("[EVENTS] Failed to send event live broadcast email on approval:", emailError);
      }
    }

    return NextResponse.json({ message: `${type} approved successfully` });
  } catch (error) {
    console.error("Failed to approve content:", error);
    return NextResponse.json(
      { error: "Failed to approve content" },
      { status: 500 }
    );
  }
}
