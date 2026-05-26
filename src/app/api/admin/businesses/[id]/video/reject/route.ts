import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businesses, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { deleteAsset } from "@/lib/mux/client";
import { resend, EMAIL_FROM } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// POST /api/admin/businesses/[id]/video/reject - Admin rejects a business video
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
    const reason: string | undefined = body.reason;

    const [business] = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        slug: businesses.slug,
        userId: businesses.userId,
        muxAssetId: businesses.muxAssetId,
      })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Delete MUX asset
    if (business.muxAssetId) {
      try {
        await deleteAsset(business.muxAssetId);
      } catch (err) {
        console.error("[Video Reject] Failed to delete MUX asset:", err);
        // Continue — clear DB fields regardless
      }
    }

    // Clear all MUX fields and set rejected status
    await db
      .update(businesses)
      .set({
        videoApprovalStatus: "rejected",
        videoRejectionReason: reason || null,
        muxPlaybackId: null,
        muxAssetId: null,
        muxUploadId: null,
        videoStatus: "none",
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
            subject: `Your video was not approved — ${business.name}`,
            html: `
              <p>Hi ${owner.firstName || "there"},</p>
              <p>Unfortunately, your video for <strong>${business.name}</strong> was not approved.</p>
              ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
              <p>You may upload a new video from your business dashboard.</p>
              <p><a href="${APP_URL}/dashboard/business">Go to your dashboard</a></p>
              <p>— The FrumToronto Team</p>
            `,
          });
        }
      } catch (emailErr) {
        console.error("[Video Reject] Failed to send rejection email:", emailErr);
      }
    }

    return NextResponse.json({ success: true, message: "Video rejected" });
  } catch (error) {
    console.error("[Video Reject] Error:", error);
    return NextResponse.json(
      { error: "Failed to reject video" },
      { status: 500 }
    );
  }
}
