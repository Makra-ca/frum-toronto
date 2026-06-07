import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { alerts, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notifyAdminOfSubmission } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, content, alertType, urgency } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!content?.trim() || content.length < 10) {
      return NextResponse.json({ error: "Content must be at least 10 characters" }, { status: 400 });
    }
    if (!alertType) {
      return NextResponse.json({ error: "Alert type is required" }, { status: 400 });
    }

    const validTypes = ["general", "bulletin", "announcement", "warning"];
    if (!validTypes.includes(alertType)) {
      return NextResponse.json({ error: "Invalid alert type" }, { status: 400 });
    }

    const validUrgencies = ["normal", "high", "urgent"];
    const finalUrgency = validUrgencies.includes(urgency) ? urgency : "normal";

    // Check auto-approve permission
    const userId = parseInt(session.user.id);
    const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const autoApprove = dbUser?.canAutoApproveAlerts || session.user.role === "admin";

    const [created] = await db
      .insert(alerts)
      .values({
        userId,
        title: title.trim(),
        content: content.trim(),
        alertType,
        urgency: finalUrgency,
        approvalStatus: autoApprove ? "approved" : "pending",
        isActive: true,
      })
      .returning();

    // Notify admins (Tier B: in-app only; digest picks up pending rows)
    await notifyAdminOfSubmission({
      contentType: "community_alert",
      title: `New community alert submitted: ${title.trim()}`,
      body:
        `${title.trim()} (${alertType}, ${finalUrgency})\n` +
        `Submitted by: ${session.user.name || session.user.email || "Unknown user"}\n\n` +
        content.trim(),
      linkUrl: "/admin/community/alerts",
      status: autoApprove ? "auto_approved" : "pending",
    });

    return NextResponse.json({
      alert: created,
      message: autoApprove
        ? "Alert posted successfully!"
        : "Alert submitted for review. It will appear once approved.",
    }, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating alert:", error);
    return NextResponse.json({ error: "Failed to submit alert" }, { status: 500 });
  }
}
