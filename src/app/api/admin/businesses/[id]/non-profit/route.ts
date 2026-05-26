import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businesses, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resend, EMAIL_FROM } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// POST /api/admin/businesses/[id]/non-profit - Admin approves or rejects non-profit verification
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const businessId = parseInt(id);

    if (isNaN(businessId)) {
      return NextResponse.json({ error: "Invalid business ID" }, { status: 400 });
    }

    const body = await request.json();
    const { action, reason } = body;

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    const [business] = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        slug: businesses.slug,
        userId: businesses.userId,
        nonProfitStatus: businesses.nonProfitStatus,
      })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    if (action === "approve") {
      await db
        .update(businesses)
        .set({
          isNonProfit: true,
          nonProfitStatus: "verified",
          nonProfitRejectionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(businesses.id, businessId));

      // Notify business owner
      if (business.userId && resend) {
        try {
          const [owner] = await db
            .select({ email: users.email, firstName: users.firstName })
            .from(users)
            .where(eq(users.id, business.userId))
            .limit(1);

          if (owner?.email) {
            await resend.emails.send({
              from: EMAIL_FROM,
              to: owner.email,
              subject: `Non-profit verification approved — ${business.name}`,
              html: `
                <p>Hi ${owner.firstName || "there"},</p>
                <p>Congratulations! Your non-profit status for <strong>${business.name}</strong> has been verified.</p>
                <p>You may now subscribe to paid plans at our discounted non-profit rate. When upgrading or renewing your subscription, select the non-profit pricing option.</p>
                <p><a href="${APP_URL}/dashboard/business">Manage your subscription</a></p>
                <p>— The FrumToronto Team</p>
              `,
            });
          }
        } catch (emailErr) {
          console.error("[Non-Profit Approve] Failed to send email:", emailErr);
        }
      }

      return NextResponse.json({ success: true, message: "Non-profit status approved" });
    } else {
      // reject
      await db
        .update(businesses)
        .set({
          isNonProfit: false,
          nonProfitStatus: "rejected",
          nonProfitRejectionReason: reason || null,
          updatedAt: new Date(),
        })
        .where(eq(businesses.id, businessId));

      // Notify business owner
      if (business.userId && resend) {
        try {
          const [owner] = await db
            .select({ email: users.email, firstName: users.firstName })
            .from(users)
            .where(eq(users.id, business.userId))
            .limit(1);

          if (owner?.email) {
            await resend.emails.send({
              from: EMAIL_FROM,
              to: owner.email,
              subject: `Non-profit verification not approved — ${business.name}`,
              html: `
                <p>Hi ${owner.firstName || "there"},</p>
                <p>We were unable to verify the non-profit status for <strong>${business.name}</strong>.</p>
                ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
                <p>You may re-apply by uploading a valid charity registration document from your business dashboard.</p>
                <p><a href="${APP_URL}/dashboard/business">Go to your dashboard</a></p>
                <p>— The FrumToronto Team</p>
              `,
            });
          }
        } catch (emailErr) {
          console.error("[Non-Profit Reject] Failed to send email:", emailErr);
        }
      }

      return NextResponse.json({ success: true, message: "Non-profit status rejected" });
    }
  } catch (error) {
    console.error("[Admin Non-Profit] Error:", error);
    return NextResponse.json(
      { error: "Failed to process non-profit application" },
      { status: 500 }
    );
  }
}
