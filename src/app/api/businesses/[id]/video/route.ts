import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businesses, subscriptionPlans } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createDirectUpload, deleteAsset } from "@/lib/mux/client";
import { notifyAdminOfSubmission } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// POST /api/businesses/[id]/video - Create a MUX direct upload URL
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const businessId = parseInt(id);

    if (isNaN(businessId)) {
      return NextResponse.json({ error: "Invalid business ID" }, { status: 400 });
    }

    const userId = parseInt(session.user.id);
    const isAdmin = session.user.role === "admin";

    // Fetch business with subscription plan
    const [business] = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        userId: businesses.userId,
        muxAssetId: businesses.muxAssetId,
        subscriptionPlanId: businesses.subscriptionPlanId,
        showVideo: subscriptionPlans.showVideo,
      })
      .from(businesses)
      .leftJoin(subscriptionPlans, eq(businesses.subscriptionPlanId, subscriptionPlans.id))
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Check ownership (admin can always manage)
    if (!isAdmin && business.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check that plan allows video
    if (!business.showVideo) {
      return NextResponse.json(
        { error: "Your subscription plan does not include video. Upgrade to Elite to use this feature." },
        { status: 403 }
      );
    }

    // If business already has a MUX asset, delete it first (replacing existing video)
    if (business.muxAssetId) {
      try {
        await deleteAsset(business.muxAssetId);
      } catch (err) {
        console.error("[MUX] Failed to delete existing asset before re-upload:", err);
        // Continue anyway — the old asset may already be gone
      }
    }

    // Create a new direct upload
    const { uploadUrl, uploadId } = await createDirectUpload();

    // Save the upload ID and set status to uploading
    await db
      .update(businesses)
      .set({
        muxUploadId: uploadId,
        muxAssetId: null,
        muxPlaybackId: null,
        videoStatus: "uploading",
        videoApprovalStatus: "pending",
        videoRejectionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, businessId));

    // Notify admins (Tier B: in-app only; digest counts videoApprovalStatus='pending')
    await notifyAdminOfSubmission({
      contentType: "business_video",
      title: `New business video uploaded — ${business.name}`,
      body:
        `Business: ${business.name}\n` +
        `Uploaded by: ${session.user.name || session.user.email || "Unknown user"}`,
      linkUrl: "/admin/businesses/video-review",
      status: "pending",
    });

    return NextResponse.json({ uploadUrl, uploadId });
  } catch (error) {
    console.error("[MUX] Error creating direct upload:", error);
    return NextResponse.json(
      { error: "Failed to create video upload" },
      { status: 500 }
    );
  }
}

// DELETE /api/businesses/[id]/video - Remove video from business
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const businessId = parseInt(id);

    if (isNaN(businessId)) {
      return NextResponse.json({ error: "Invalid business ID" }, { status: 400 });
    }

    const userId = parseInt(session.user.id);
    const isAdmin = session.user.role === "admin";

    // Fetch business
    const [business] = await db
      .select({
        id: businesses.id,
        userId: businesses.userId,
        muxAssetId: businesses.muxAssetId,
      })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Check ownership
    if (!isAdmin && business.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete MUX asset if it exists
    if (business.muxAssetId) {
      try {
        await deleteAsset(business.muxAssetId);
      } catch (err) {
        console.error("[MUX] Failed to delete MUX asset:", err);
        // Continue anyway — clear the DB fields regardless
      }
    }

    // Clear all MUX fields
    await db
      .update(businesses)
      .set({
        muxPlaybackId: null,
        muxAssetId: null,
        muxUploadId: null,
        videoStatus: "none",
        videoApprovalStatus: "pending",
        videoRejectionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, businessId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[MUX] Error deleting video:", error);
    return NextResponse.json(
      { error: "Failed to delete video" },
      { status: 500 }
    );
  }
}
