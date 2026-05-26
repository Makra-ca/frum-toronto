import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businesses, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resend, EMAIL_FROM } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// POST /api/admin/businesses/[id]/video/approve - Admin approves a business video
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

    const [business] = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        slug: businesses.slug,
        userId: businesses.userId,
        videoStatus: businesses.videoStatus,
        muxPlaybackId: businesses.muxPlaybackId,
      })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    if (business.videoStatus !== "ready") {
      return NextResponse.json(
        { error: "Video is not ready for approval" },
        { status: 400 }
      );
    }

    await db
      .update(businesses)
      .set({
        videoApprovalStatus: "approved",
        videoRejectionReason: null,
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
            subject: `Your video has been approved — ${business.name}`,
            html: `
              <p>Hi ${owner.firstName || "there"},</p>
              <p>Great news! Your video for <strong>${business.name}</strong> has been approved and is now live on your listing.</p>
              <p><a href="${APP_URL}/directory/business/${business.slug}">View your listing</a></p>
              <p>— The FrumToronto Team</p>
            `,
          });
        }
      } catch (emailErr) {
        console.error("[Video Approve] Failed to send approval email:", emailErr);
      }
    }

    return NextResponse.json({ success: true, message: "Video approved" });
  } catch (error) {
    console.error("[Video Approve] Error:", error);
    return NextResponse.json(
      { error: "Failed to approve video" },
      { status: 500 }
    );
  }
}
