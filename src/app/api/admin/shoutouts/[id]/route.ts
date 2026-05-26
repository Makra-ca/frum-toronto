import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businessShoutouts, businesses, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resend, EMAIL_FROM } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// PATCH /api/admin/shoutouts/[id] - Admin approves or rejects a shoutout
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const shoutoutId = parseInt(id);

    if (isNaN(shoutoutId)) {
      return NextResponse.json({ error: "Invalid shoutout ID" }, { status: 400 });
    }

    const body = await request.json();
    const { action, reason } = body;

    if (!action || !["approve", "reject", "reschedule"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'approve', 'reject', or 'reschedule'" },
        { status: 400 }
      );
    }

    // Fetch shoutout with business and owner info
    const [shoutout] = await db
      .select({
        id: businessShoutouts.id,
        status: businessShoutouts.status,
        scheduledDate: businessShoutouts.scheduledDate,
        businessId: businessShoutouts.businessId,
        businessName: businesses.name,
        businessSlug: businesses.slug,
        businessUserId: businesses.userId,
      })
      .from(businessShoutouts)
      .leftJoin(businesses, eq(businessShoutouts.businessId, businesses.id))
      .where(eq(businessShoutouts.id, shoutoutId))
      .limit(1);

    if (!shoutout) {
      return NextResponse.json({ error: "Shoutout not found" }, { status: 404 });
    }

    if (action === "approve") {
      await db
        .update(businessShoutouts)
        .set({
          status: "approved",
          rejectionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(businessShoutouts.id, shoutoutId));

      // Notify business owner
      if (shoutout.businessUserId && resend) {
        try {
          const [owner] = await db
            .select({ email: users.email, firstName: users.firstName })
            .from(users)
            .where(eq(users.id, shoutout.businessUserId))
            .limit(1);

          if (owner?.email) {
            await resend.emails.send({
              from: EMAIL_FROM,
              to: owner.email,
              subject: `Your newsletter shoutout has been approved — ${shoutout.businessName}`,
              html: `
                <p>Hi ${owner.firstName || "there"},</p>
                <p>Great news! Your newsletter shoutout for <strong>${shoutout.businessName}</strong> has been approved and is scheduled for <strong>${shoutout.scheduledDate}</strong>.</p>
                <p>Your content will be included in the newsletter sent on that date.</p>
                <p>— The FrumToronto Team</p>
              `,
            });
          }
        } catch (emailErr) {
          console.error("[Admin Shoutout Approve] Failed to send email:", emailErr);
        }
      }

      return NextResponse.json({ success: true, message: "Shoutout approved" });
    } else if (action === "reject") {
      await db
        .update(businessShoutouts)
        .set({
          status: "rejected",
          rejectionReason: reason || null,
          updatedAt: new Date(),
        })
        .where(eq(businessShoutouts.id, shoutoutId));

      // Notify business owner
      if (shoutout.businessUserId && resend) {
        try {
          const [owner] = await db
            .select({ email: users.email, firstName: users.firstName })
            .from(users)
            .where(eq(users.id, shoutout.businessUserId))
            .limit(1);

          if (owner?.email) {
            await resend.emails.send({
              from: EMAIL_FROM,
              to: owner.email,
              subject: `Your newsletter shoutout was not approved — ${shoutout.businessName}`,
              html: `
                <p>Hi ${owner.firstName || "there"},</p>
                <p>Unfortunately, your newsletter shoutout for <strong>${shoutout.businessName}</strong> was not approved.</p>
                ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
                <p>You may revise your content and resubmit from your business dashboard.</p>
                <p><a href="${APP_URL}/dashboard/business">Go to your dashboard</a></p>
                <p>— The FrumToronto Team</p>
              `,
            });
          }
        } catch (emailErr) {
          console.error("[Admin Shoutout Reject] Failed to send email:", emailErr);
        }
      }

      return NextResponse.json({ success: true, message: "Shoutout rejected" });
    } else if (action === "reschedule") {
      // Admin can reschedule an approved/sent shoutout
      const { scheduledDate } = body;
      if (!scheduledDate) {
        return NextResponse.json({ error: "scheduledDate is required for reschedule" }, { status: 400 });
      }

      await db
        .update(businessShoutouts)
        .set({
          scheduledDate,
          status: "approved", // Reset to approved after reschedule
          updatedAt: new Date(),
        })
        .where(eq(businessShoutouts.id, shoutoutId));

      return NextResponse.json({ success: true, message: "Shoutout rescheduled" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[Admin Shoutout PATCH] Error:", error);
    return NextResponse.json(
      { error: "Failed to process shoutout" },
      { status: 500 }
    );
  }
}
