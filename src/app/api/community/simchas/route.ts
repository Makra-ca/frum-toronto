import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { simchas, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notifyAdminOfSubmission } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { familyName, announcement, typeId, eventDate, location, photoUrl } = body;

    if (!familyName?.trim()) {
      return NextResponse.json({ error: "Family name is required" }, { status: 400 });
    }
    if (!announcement?.trim() || announcement.length < 10) {
      return NextResponse.json({ error: "Announcement must be at least 10 characters" }, { status: 400 });
    }

    // Check auto-approve permission
    const userId = parseInt(session.user.id);
    const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const autoApprove = dbUser?.canAutoApproveSimchas || session.user.role === "admin";

    const [created] = await db
      .insert(simchas)
      .values({
        userId,
        familyName: familyName.trim(),
        announcement: announcement.trim(),
        typeId: typeId ? parseInt(typeId) : null,
        eventDate: eventDate || null,
        location: location?.trim() || null,
        photoUrl: photoUrl || null,
        approvalStatus: autoApprove ? "approved" : "pending",
        isActive: true,
      })
      .returning();

    // Notify admins (Tier B: in-app only; digest picks up pending rows)
    await notifyAdminOfSubmission({
      contentType: "simcha",
      title: `New simcha submitted: ${familyName.trim()}`,
      body:
        `Family: ${familyName.trim()}\n` +
        `Submitted by: ${session.user.name || session.user.email || "Unknown user"}\n\n` +
        announcement.trim(),
      linkUrl: "/admin/community/simchas",
      status: autoApprove ? "auto_approved" : "pending",
    });

    return NextResponse.json({
      simcha: created,
      message: autoApprove
        ? "Simcha posted successfully!"
        : "Simcha submitted for review. It will appear once approved.",
    }, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating simcha:", error);
    return NextResponse.json({ error: "Failed to submit simcha" }, { status: 500 });
  }
}
