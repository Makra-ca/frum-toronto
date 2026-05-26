import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businesses, businessCategories, subscriptionPlans, businessSubscriptions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/businesses/[id] - Fetch a single business (owner or admin)
export async function GET(
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

    const [business] = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        slug: businesses.slug,
        userId: businesses.userId,
        approvalStatus: businesses.approvalStatus,
        isActive: businesses.isActive,
        // Video fields
        muxPlaybackId: businesses.muxPlaybackId,
        muxAssetId: businesses.muxAssetId,
        muxUploadId: businesses.muxUploadId,
        videoStatus: businesses.videoStatus,
        videoApprovalStatus: businesses.videoApprovalStatus,
        videoRejectionReason: businesses.videoRejectionReason,
        // Non-profit fields
        isNonProfit: businesses.isNonProfit,
        nonProfitDocumentUrl: businesses.nonProfitDocumentUrl,
        nonProfitStatus: businesses.nonProfitStatus,
        nonProfitRejectionReason: businesses.nonProfitRejectionReason,
        // Dining
        diningType: businesses.diningType,
        // Plan info
        subscriptionPlanId: businesses.subscriptionPlanId,
        planName: subscriptionPlans.name,
        planSlug: subscriptionPlans.slug,
        showVideo: subscriptionPlans.showVideo,
        // Category info
        categoryId: businesses.categoryId,
        categoryName: businessCategories.name,
        categoryIsRestaurant: businessCategories.isRestaurant,
      })
      .from(businesses)
      .leftJoin(subscriptionPlans, eq(businesses.subscriptionPlanId, subscriptionPlans.id))
      .leftJoin(businessCategories, eq(businesses.categoryId, businessCategories.id))
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Only owner or admin can access
    if (!isAdmin && business.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check for active subscription (used for shoutout eligibility)
    const [activeSub] = await db
      .select({
        id: businessSubscriptions.id,
        billingCycle: businessSubscriptions.billingCycle,
        status: businessSubscriptions.status,
      })
      .from(businessSubscriptions)
      .where(
        and(
          eq(businessSubscriptions.businessId, businessId),
          eq(businessSubscriptions.status, "active")
        )
      )
      .limit(1);

    // Determine if eligible for shoutouts (Elite plan + active subscription)
    const isElite =
      business.showVideo === true ||
      (business.planName || "").toLowerCase().includes("elite") ||
      (business.planSlug || "").toLowerCase().includes("elite");

    return NextResponse.json({
      ...business,
      activeSub: activeSub || null,
      isElite,
    });
  } catch (error) {
    console.error("[Business GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch business" },
      { status: 500 }
    );
  }
}
