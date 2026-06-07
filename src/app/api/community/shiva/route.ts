import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shivaNotifications, users } from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { notifyAdminOfSubmission } from "@/lib/notifications";

// GET - Fetch all approved, active shiva notices
export async function GET() {
  try {
    const today = new Date().toISOString().split("T")[0];

    const notices = await db
      .select()
      .from(shivaNotifications)
      .where(
        and(
          eq(shivaNotifications.approvalStatus, "approved"),
          gte(shivaNotifications.shivaEnd, today)
        )
      )
      .orderBy(shivaNotifications.shivaEnd);

    return NextResponse.json(notices);
  } catch (error) {
    console.error("Failed to fetch shiva notices:", error);
    return NextResponse.json(
      { error: "Failed to fetch shiva notices" },
      { status: 500 }
    );
  }
}

// POST - Submit a new shiva notice (requires login)
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be logged in to submit a shiva notice" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      niftarName,
      niftarNameHebrew,
      mournerNames,
      shivaAddress,
      shivaStart,
      shivaEnd,
      shivaHours,
      mealInfo,
      donationInfo,
      contactPhone,
    } = body;

    // Validate required fields
    if (!niftarName || !niftarName.trim()) {
      return NextResponse.json(
        { error: "Name of the niftar is required" },
        { status: 400 }
      );
    }

    if (!shivaStart || !shivaEnd) {
      return NextResponse.json(
        { error: "Shiva start and end dates are required" },
        { status: 400 }
      );
    }

    // Check if user has auto-approve permission for shiva
    const [user] = await db
      .select({ canAutoApproveShiva: users.canAutoApproveShiva })
      .from(users)
      .where(eq(users.id, parseInt(session.user.id)))
      .limit(1);

    const canAutoApprove = user?.canAutoApproveShiva ?? false;
    const approvalStatus = canAutoApprove ? "approved" : "pending";

    // Validate mourner names array
    const validMournerNames = Array.isArray(mournerNames)
      ? mournerNames.filter((name: string) => typeof name === "string" && name.trim())
      : [];

    const [newNotice] = await db
      .insert(shivaNotifications)
      .values({
        userId: parseInt(session.user.id),
        niftarName: niftarName.trim(),
        niftarNameHebrew: niftarNameHebrew?.trim() || null,
        mournerNames: validMournerNames,
        shivaAddress: shivaAddress?.trim() || null,
        shivaStart,
        shivaEnd,
        shivaHours: shivaHours?.trim() || null,
        mealInfo: mealInfo?.trim() || null,
        donationInfo: donationInfo?.trim() || null,
        contactPhone: contactPhone?.trim() || null,
        approvalStatus,
      })
      .returning();

    // Notify admins (in-app for all; instant email to shiva recipients when pending)
    {
      const userName = session.user.name || session.user.email || "Unknown user";
      const mournersList = validMournerNames.join(", ") || "Not provided";

      await notifyAdminOfSubmission({
        contentType: "shiva",
        title: `New Shiva Notice: ${niftarName.trim()}`,
        body:
          `Niftar: ${niftarName.trim()}\n` +
          (niftarNameHebrew?.trim() ? `Hebrew Name: ${niftarNameHebrew.trim()}\n` : "") +
          `Mourners: ${mournersList}\n` +
          `Address: ${shivaAddress?.trim() || "Not provided"}\n` +
          `Dates: ${shivaStart} to ${shivaEnd}\n` +
          `Hours: ${shivaHours?.trim() || "Not provided"}\n` +
          `Contact: ${contactPhone?.trim() || "Not provided"}\n` +
          `Submitted by: ${userName}`,
        linkUrl: "/admin/community/shiva",
        status: approvalStatus === "pending" ? "pending" : "auto_approved",
      });
    }

    const message = canAutoApprove
      ? "Shiva notice submitted successfully and is now visible."
      : "Shiva notice submitted successfully. It will appear after admin approval.";

    return NextResponse.json({
      message,
      notice: newNotice,
      autoApproved: canAutoApprove,
    });
  } catch (error) {
    console.error("Failed to submit shiva notice:", error);
    return NextResponse.json(
      { error: "Failed to submit shiva notice" },
      { status: 500 }
    );
  }
}
