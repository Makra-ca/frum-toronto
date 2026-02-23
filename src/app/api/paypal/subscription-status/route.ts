import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businessSubscriptions, businesses, subscriptionPlans } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getPayPalSubscription } from "@/lib/paypal/config";

/**
 * GET /api/paypal/subscription-status?businessId=123
 *
 * Get subscription status for a business
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    if (!businessId) {
      return NextResponse.json(
        { error: "businessId is required" },
        { status: 400 }
      );
    }

    const businessIdNum = parseInt(businessId);

    // Get business
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessIdNum))
      .limit(1);

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Check ownership
    const isAdmin = session.user.role === "admin";
    const isOwner = business.userId === parseInt(session.user.id);

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "You don't have permission to view this subscription" },
        { status: 403 }
      );
    }

    // Get subscription from our database
    const [subscription] = await db
      .select()
      .from(businessSubscriptions)
      .where(eq(businessSubscriptions.businessId, businessIdNum))
      .limit(1);

    // Get current plan
    const [currentPlan] = business.subscriptionPlanId
      ? await db
          .select()
          .from(subscriptionPlans)
          .where(eq(subscriptionPlans.id, business.subscriptionPlanId))
          .limit(1)
      : [null];

    // If no subscription, return basic info
    if (!subscription) {
      return NextResponse.json({
        hasSubscription: false,
        currentPlan: currentPlan || null,
        subscription: null,
        paypalStatus: null,
      });
    }

    // If there's a PayPal subscription, optionally fetch fresh status
    let paypalStatus = null;
    if (subscription.paypalSubscriptionId) {
      paypalStatus = await getPayPalSubscription(subscription.paypalSubscriptionId);
    }

    return NextResponse.json({
      hasSubscription: true,
      currentPlan,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        billingCycle: subscription.billingCycle,
        startDate: subscription.currentPeriodStart,
        endDate: subscription.currentPeriodEnd,
        cancelledAt: subscription.cancelledAt,
      },
      paypalStatus,
    });
  } catch (error) {
    console.error("[PayPal] Error getting subscription status:", error);
    return NextResponse.json(
      { error: "Failed to get subscription status" },
      { status: 500 }
    );
  }
}
