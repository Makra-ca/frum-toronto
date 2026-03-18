import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { businesses, subscriptionPlans } from "@/lib/db/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET - Fetch random featured businesses for homepage ads
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const placement = searchParams.get("placement"); // "banner" or "sidebar"
    const limit = parseInt(searchParams.get("limit") || "3");

    if (!placement || !["banner", "sidebar"].includes(placement)) {
      return NextResponse.json(
        { error: "Invalid placement. Must be 'banner' or 'sidebar'" },
        { status: 400 }
      );
    }

    // Determine which column to filter on
    const placementColumn = placement === "banner"
      ? subscriptionPlans.showInHomepageBanner
      : subscriptionPlans.showInHomepageSidebar;

    // Fetch businesses that:
    // 1. Have an approved status
    // 2. Are active
    // 3. Have a subscription plan with the appropriate placement enabled
    // 4. Have a banner image uploaded (required for ad display)
    // 5. Randomly ordered
    const featuredBusinesses = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        slug: businesses.slug,
        tagline: businesses.tagline,
        bannerImageUrl: businesses.bannerImageUrl,
        logoUrl: businesses.logoUrl,
      })
      .from(businesses)
      .innerJoin(
        subscriptionPlans,
        eq(businesses.subscriptionPlanId, subscriptionPlans.id)
      )
      .where(
        and(
          eq(businesses.approvalStatus, "approved"),
          eq(businesses.isActive, true),
          eq(placementColumn, true),
          isNotNull(businesses.bannerImageUrl)
        )
      )
      .orderBy(sql`RANDOM()`)
      .limit(limit);

    return NextResponse.json({
      businesses: featuredBusinesses,
      placement,
    });
  } catch (error) {
    console.error("Error fetching featured businesses:", error);
    return NextResponse.json(
      { error: "Failed to fetch featured businesses" },
      { status: 500 }
    );
  }
}
