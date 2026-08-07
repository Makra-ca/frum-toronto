import { NextRequest, NextResponse } from "next/server";
import { communityAlertSchema } from "@/lib/validations/community-submissions";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { alerts } from "@/lib/db/schema";
import { notifyAdminOfSubmission } from "@/lib/notifications";
import { assertCanPost } from "@/lib/auth/require-verified";
import { resolveApprovalStatus } from "@/lib/submissions/auto-approve";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Submissions require a verified email address (admins exempt). Also
    // re-checks the account is not disabled, since a session can outlive a block.
    const notAllowed = await assertCanPost(session?.user?.id);
    if (notAllowed) return notAllowed;

    const body = await request.json();

    // This route destructured the raw body and hand-checked three fields, so
    // an over-length title reached a varchar(200) and surfaced as a 500.
    const parsed = communityAlertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
    const { title, content, alertType, urgency } = parsed.data;

    // Check auto-approve permission
    const userId = parseInt(session.user.id);
    const autoApprove =
      (await resolveApprovalStatus("alert", userId, session.user.role, null)) ===
      "approved";

    const [created] = await db
      .insert(alerts)
      .values({
        userId,
        title,
        content,
        alertType,
        urgency,
        approvalStatus: autoApprove ? "approved" : "pending",
        isActive: true,
      })
      .returning();

    // Notify admins (Tier B: in-app only; digest picks up pending rows)
    await notifyAdminOfSubmission({
      contentType: "community_alert",
      title: `New community alert submitted: ${title.trim()}`,
      body:
        `${title.trim()} (${alertType}, ${urgency})\n` +
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
