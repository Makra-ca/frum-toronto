import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { tehillimList, users } from "@/lib/db/schema";
import { eq, and, or, gt, isNull } from "drizzle-orm";
import { notifyAdminOfSubmission } from "@/lib/notifications";

// GET - Fetch all approved, active, non-expired tehillim names
export async function GET() {
  try {
    const today = new Date().toISOString().split("T")[0];

    const names = await db
      .select()
      .from(tehillimList)
      .where(
        and(
          eq(tehillimList.approvalStatus, "approved"),
          eq(tehillimList.isActive, true),
          or(
            eq(tehillimList.isPermanent, true),
            isNull(tehillimList.expiresAt),
            gt(tehillimList.expiresAt, today)
          )
        )
      );

    return NextResponse.json(names);
  } catch (error) {
    console.error("Failed to fetch tehillim list:", error);
    return NextResponse.json(
      { error: "Failed to fetch tehillim list" },
      { status: 500 }
    );
  }
}

// POST - Submit a new tehillim name (requires login, goes to pending)
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be logged in to add a name" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { hebrewName, englishName, motherHebrewName, reason, durationDays } = body;

    const hasHebrewName = hebrewName && hebrewName.trim() !== "";
    const hasEnglishName = englishName && englishName.trim() !== "";

    if (!hasHebrewName && !hasEnglishName) {
      return NextResponse.json(
        { error: "Either Hebrew name or English name is required" },
        { status: 400 }
      );
    }

    // Check if user has auto-approve permission for tehillim
    const [user] = await db
      .select({ canAutoApproveTehillim: users.canAutoApproveTehillim })
      .from(users)
      .where(eq(users.id, parseInt(session.user.id)))
      .limit(1);

    const canAutoApprove = user?.canAutoApproveTehillim ?? false;
    const approvalStatus = canAutoApprove ? "approved" : "pending";

    // Calculate expiration date (default 14 days if not specified, max 30)
    const days = Math.min(Math.max(parseInt(durationDays) || 14, 1), 30);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    const expiresAtStr = expiresAt.toISOString().split("T")[0];

    const [newEntry] = await db
      .insert(tehillimList)
      .values({
        userId: parseInt(session.user.id),
        hebrewName: hebrewName?.trim() || null,
        englishName: englishName?.trim() || null,
        motherHebrewName: motherHebrewName?.trim() || null,
        reason: reason?.trim() || null,
        isActive: true,
        approvalStatus,
        expiresAt: expiresAtStr,
        isPermanent: false,
      })
      .returning();

    // Notify admins (in-app for all; instant email to tehillim recipients when pending)
    {
      const displayName = hebrewName?.trim() || englishName?.trim() || "Unknown";
      const userName = session.user.name || session.user.email || "Unknown user";

      await notifyAdminOfSubmission({
        contentType: "tehillim",
        title: `New Tehillim Submission: ${displayName}`,
        body:
          `Hebrew Name: ${hebrewName?.trim() || "Not provided"}\n` +
          `English Name: ${englishName?.trim() || "Not provided"}\n` +
          `Mother's Hebrew Name: ${motherHebrewName?.trim() || "Not provided"}\n` +
          `Reason: ${reason?.trim() || "Not provided"}\n` +
          `Duration: ${days} days (expires ${expiresAtStr})\n` +
          `Submitted by: ${userName}`,
        linkUrl: "/admin/community/tehillim",
        status: approvalStatus === "pending" ? "pending" : "auto_approved",
      });
    }

    const message = canAutoApprove
      ? "Name added successfully and is now visible on the Tehillim list."
      : "Name submitted successfully. It will appear after admin approval.";

    return NextResponse.json({
      message,
      entry: newEntry,
      autoApproved: canAutoApprove,
    });
  } catch (error) {
    console.error("Failed to add tehillim name:", error);
    return NextResponse.json(
      { error: "Failed to add name" },
      { status: 500 }
    );
  }
}
