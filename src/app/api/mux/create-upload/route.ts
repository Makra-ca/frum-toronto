import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businesses, subscriptionPlans } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createDirectUpload, deleteAsset } from "@/lib/mux/client";

export const dynamic = "force-dynamic";

// POST /api/mux/create-upload - Create a MUX direct upload URL for a business video
// Body: { businessId: number }
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { businessId: rawBusinessId } = body;

    if (!rawBusinessId) {
      return NextResponse.json({ error: "businessId is required" }, { status: 400 });
    }

    const businessId = parseInt(String(rawBusinessId));
    if (isNaN(businessId)) {
      return NextResponse.json({ error: "Invalid businessId" }, { status: 400 });
    }

    const userId = parseInt(session.user.id);
    const isAdmin = session.user.role === "admin";

    // Fetch business with subscription plan
    const [business] = await db
      .select({
        id: businesses.id,
        userId: businesses.userId,
        muxAssetId: businesses.muxAssetId,
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

    // Check plan allows video
    if (!business.showVideo) {
      return NextResponse.json(
        { error: "Your subscription plan does not include video. Upgrade to Elite to use this feature." },
        { status: 403 }
      );
    }

    // If business already has a MUX asset, delete it first
    if (business.muxAssetId) {
      try {
        await deleteAsset(business.muxAssetId);
      } catch (err) {
        console.error("[MUX create-upload] Failed to delete existing asset:", err);
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

    return NextResponse.json({ uploadUrl, uploadId });
  } catch (error) {
    console.error("[MUX create-upload] Error:", error);
    return NextResponse.json(
      { error: "Failed to create video upload" },
      { status: 500 }
    );
  }
}
