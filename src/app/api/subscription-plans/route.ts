import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subscriptionPlans } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

/**
 * GET /api/subscription-plans
 *
 * Public endpoint to get active subscription plans for pricing display
 */
export async function GET() {
  try {
    const plans = await db
      .select({
        id: subscriptionPlans.id,
        name: subscriptionPlans.name,
        slug: subscriptionPlans.slug,
        description: subscriptionPlans.description,
        priceMonthly: subscriptionPlans.priceMonthly,
        priceYearly: subscriptionPlans.priceYearly,
        maxCategories: subscriptionPlans.maxCategories,
        maxPhotos: subscriptionPlans.maxPhotos,
        showDescription: subscriptionPlans.showDescription,
        showContactName: subscriptionPlans.showContactName,
        showEmail: subscriptionPlans.showEmail,
        showWebsite: subscriptionPlans.showWebsite,
        showHours: subscriptionPlans.showHours,
        showMap: subscriptionPlans.showMap,
        showLogo: subscriptionPlans.showLogo,
        showSocialLinks: subscriptionPlans.showSocialLinks,
        showKosherBadge: subscriptionPlans.showKosherBadge,
        isFeatured: subscriptionPlans.isFeatured,
        priorityInSearch: subscriptionPlans.priorityInSearch,
        displayOrder: subscriptionPlans.displayOrder,
      })
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(asc(subscriptionPlans.displayOrder));

    return NextResponse.json({ plans });
  } catch (error) {
    console.error("Error fetching subscription plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription plans" },
      { status: 500 }
    );
  }
}
