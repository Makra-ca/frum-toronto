import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shivaNotifications, formEmailRecipients, users } from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { resend, EMAIL_FROM } from "@/lib/email/resend";

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

    // Send admin notification email (only if needs approval)
    if (approvalStatus === "pending") {
      try {
        // Get admin email recipients for shiva form type
        const recipients = await db
          .select({ email: formEmailRecipients.email })
          .from(formEmailRecipients)
          .where(
            and(
              eq(formEmailRecipients.formType, "shiva"),
              eq(formEmailRecipients.isActive, true)
            )
          );

        const adminEmails = recipients.map((r) => r.email);

        if (adminEmails.length > 0 && resend) {
          const userName = session.user.name || session.user.email || "Unknown user";
          const mournersList = validMournerNames.join(", ") || "Not provided";

          await resend.emails.send({
            from: EMAIL_FROM,
            to: adminEmails,
            subject: `New Shiva Notice: ${niftarName.trim()}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1e3a5f;">New Shiva Notice Submitted</h2>
                <p>A new shiva notice has been submitted and is awaiting approval.</p>

                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p><strong>Niftar:</strong> ${niftarName.trim()}</p>
                  ${niftarNameHebrew ? `<p><strong>Hebrew Name:</strong> ${niftarNameHebrew.trim()}</p>` : ""}
                  <p><strong>Mourners:</strong> ${mournersList}</p>
                  <p><strong>Address:</strong> ${shivaAddress?.trim() || "Not provided"}</p>
                  <p><strong>Dates:</strong> ${shivaStart} to ${shivaEnd}</p>
                  <p><strong>Hours:</strong> ${shivaHours?.trim() || "Not provided"}</p>
                  <p><strong>Contact:</strong> ${contactPhone?.trim() || "Not provided"}</p>
                  <p><strong>Submitted by:</strong> ${userName}</p>
                </div>

                <p>
                  <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/admin/content/shiva"
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
