import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { tehillimList, formEmailRecipients, users } from "@/lib/db/schema";
import { eq, and, or, gt, isNull } from "drizzle-orm";
import { resend, EMAIL_FROM } from "@/lib/email/resend";

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

    // Send admin notification email (only if needs approval)
    if (approvalStatus === "pending") {
      try {
        // Get admin email recipients for tehillim form type
        const recipients = await db
          .select({ email: formEmailRecipients.email })
          .from(formEmailRecipients)
          .where(
            and(
              eq(formEmailRecipients.formType, "tehillim"),
              eq(formEmailRecipients.isActive, true)
            )
          );

        const adminEmails = recipients.map((r) => r.email);

        if (adminEmails.length > 0 && resend) {
        const displayName = hebrewName?.trim() || englishName?.trim() || "Unknown";
        const userName = session.user.name || session.user.email || "Unknown user";

        await resend.emails.send({
          from: EMAIL_FROM,
          to: adminEmails,
          subject: `New Tehillim Submission: ${displayName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1e3a5f;">New Tehillim Name Submitted</h2>
              <p>A new name has been submitted to the Tehillim list and is awaiting approval.</p>

              <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Hebrew Name:</strong> ${hebrewName?.trim() || "Not provided"}</p>
                <p><strong>English Name:</strong> ${englishName?.trim() || "Not provided"}</p>
                <p><strong>Mother's Hebrew Name:</strong> ${motherHebrewName?.trim() || "Not provided"}</p>
                <p><strong>Reason:</strong> ${reason?.trim() || "Not provided"}</p>
                <p><strong>Duration:</strong> ${days} days (expires ${expiresAtStr})</p>
                <p><strong>Submitted by:</strong> ${userName}</p>
              </div>

              <p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/admin/content"
                   style="display: inline-block; padding: 10px 20px; background: #1e3a5f; color: white; text-decoration: none; border-radius: 5px;">
                  Review in Admin Panel
                </a>
              </p>

              <p style="color: #666; font-size: 12px; margin-top: 30px;">
                This is an automated message from FrumToronto.
              </p>
            </div>
          `,
          });
        }
      } catch (emailError) {
        // Don't fail the submission if email fails
        console.error("Failed to send admin notification email:", emailError);
      }
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
