import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { kosherAlerts } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { notifyAdminOfSubmission } from "@/lib/notifications";
import { assertCanPost } from "@/lib/auth/require-verified";
import { resolveApprovalStatus } from "@/lib/submissions/auto-approve";
import { sendKosherAlertBroadcast } from "@/lib/email/send";

const submissionSchema = z.object({
  productName: z.string().min(1, "Product name is required").max(200),
  brand: z.string().max(200).optional().nullable(),
  alertType: z.enum(["recall", "status_change", "warning", "update"]).optional().nullable(),
  description: z.string().min(10, "Description must be at least 10 characters"),
  certifyingAgency: z.string().max(200).optional().nullable(),
  effectiveDate: z.string().optional().nullable(),
  issueDate: z.string().optional().nullable(),
});

// GET - Public listing of approved alerts
export async function GET() {
  try {
    const alerts = await db
      .select({
        id: kosherAlerts.id,
        productName: kosherAlerts.productName,
        brand: kosherAlerts.brand,
        alertType: kosherAlerts.alertType,
        description: kosherAlerts.description,
        certifyingAgency: kosherAlerts.certifyingAgency,
        effectiveDate: kosherAlerts.effectiveDate,
        createdAt: kosherAlerts.createdAt,
      })
      .from(kosherAlerts)
      .where(
        and(
          eq(kosherAlerts.isActive, true),
          eq(kosherAlerts.approvalStatus, "approved")
        )
      )
      .orderBy(desc(kosherAlerts.createdAt));

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("[API] Error fetching public kosher alerts:", error);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}

// POST - User submission of new kosher alert
export async function POST(request: NextRequest) {
  const session = await auth();

  // Require login for submissions
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please sign in to submit a kosher alert" }, { status: 401 });
  }

  // Submissions require a verified email address (admins exempt). Also
  // re-checks the account is not disabled, since a session can outlive a block.
  const notAllowed = await assertCanPost(session?.user?.id);
  if (notAllowed) return notAllowed;

  try {
    const body = await request.json();
    const result = submissionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const userId = parseInt(session.user.id);

    const autoApprove =
      (await resolveApprovalStatus(
        "kosherAlert",
        userId,
        session.user.role,
        null
      )) === "approved";

    const [newAlert] = await db
      .insert(kosherAlerts)
      .values({
        userId,
        productName: result.data.productName,
        brand: result.data.brand || null,
        alertType: result.data.alertType || null,
        description: result.data.description,
        certifyingAgency: result.data.certifyingAgency || null,
        effectiveDate: result.data.effectiveDate || null,
        issueDate: result.data.issueDate || null,
        approvalStatus: autoApprove ? "approved" : "pending",
        isActive: true,
      })
      .returning();

    // Notify admins (in-app for all; instant email to kosher_alert recipients when pending)
    await notifyAdminOfSubmission({
      contentType: "kosher_alert",
      title: `New kosher alert: ${result.data.productName}`,
      body:
        `Product: ${result.data.productName}\n` +
        (result.data.brand ? `Brand: ${result.data.brand}\n` : "") +
        (result.data.alertType ? `Type: ${result.data.alertType}\n` : "") +
        (result.data.certifyingAgency ? `Agency: ${result.data.certifyingAgency}\n` : "") +
        `Submitted by: ${session.user.name || session.user.email || "Unknown user"}\n\n` +
        result.data.description,
      linkUrl: "/admin/community/kosher-alerts",
      status: autoApprove ? "auto_approved" : "pending",
    });

    // An auto-approved alert goes live immediately, so it announces
    // immediately — the same rule as events and shiva. broadcast_at is stamped
    // so a later correction cannot announce it a second time.
    //
    // Note what this grants: a holder of canAutoApproveKosherAlerts can email
    // every kosher-alert subscriber with no admin in the loop. That is what
    // the permission means for the other two announcing types, and a recall
    // that waits for an admin is a recall nobody hears about. The flag is
    // granted and revoked by an admin.
    if (autoApprove) {
      try {
        const notified = await sendKosherAlertBroadcast(newAlert);
        if (notified > 0) {
          await db
            .update(kosherAlerts)
            .set({ broadcastAt: new Date() })
            .where(eq(kosherAlerts.id, newAlert.id));
        }
      } catch (emailError) {
        console.error("[KOSHER] Failed to send as-posted broadcast:", emailError);
      }
    }

    return NextResponse.json({
      alert: newAlert,
      message: autoApprove
        ? "Your kosher alert has been published."
        : "Thank you! Your submission will be reviewed by our team.",
    }, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating kosher alert submission:", error);
    return NextResponse.json({ error: "Failed to submit alert" }, { status: 500 });
  }
}
