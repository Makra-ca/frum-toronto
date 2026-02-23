import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businessSubscriptions, businesses, subscriptionPlans } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cancelPayPalSubscription } from "@/lib/paypal/config";

/**
 * POST /api/paypal/cancel-subscription
 *
 * Cancel a subscription for a business
 *
 * Body:
 * - businessId: number
 * - reason: string (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { businessId, reason } = body;

    if (!businessId) {
      return NextResponse.json(
        { error: "businessId is required" },
        { status: 400 }
      );
    }

    // Get business
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Check ownership
    const isAdmin = session.user.role === "admin";
    const isOwner = business.userId === session.user.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "You don't have permission to cancel this subscription" },
        { status: 403 }
      );
    }

    // Get subscription
    const [subscription] = await db
      .select()
      .from(businessSubscriptions)
      .where(eq(businessSubscriptions.businessId, businessId))
      .limit(1);

    if (!subscription) {
      return NextResponse.json(
        { error: "No subscription found for this business" },
        { status: 404 }
      );
    }

    if (subscription.status === "cancelled") {
      return NextResponse.json(
        { error: "Subscription is already cancelled" },
        { status: 400 }
      );
    }

    // Cancel with PayPal if there's a PayPal subscription
    if (subscription.paypalSubscriptionId) {
      const cancelled = await cancelPayPalSubscription(
        subscription.paypalSubscriptionId,
        reason || "Cancelled by user"
      );

      if (!cancelled) {
        return NextResponse.json(
          { error: "Failed to cancel subscription with PayPal" },
          { status: 500 }
        );
      }
    }

    // Update our database
    await db
      .update(businessSubscriptions)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(businessSubscriptions.id, subscription.id));

    // Downgrade business to free plan (they keep features until endDate)
    // Note: The webhook will also handle this, but we do it here for immediate feedback
    const [freePlan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.slug, "free"))
      .limit(1);

    if (freePlan) {
      await db
        .update(businesses)
        .set({
          subscriptionPlanId: freePlan.id,
        })
        .where(eq(businesses.id, businessId));
    }

    return NextResponse.json({
      success: true,
      message: "Subscription cancelled successfully",
      endDate: subscription.endDate, // They keep access until this date
    });
  } catch (error) {
    console.error("[PayPal] Error cancelling subscription:", error);
    return NextResponse.json(
      { error: "Failed to cancel subscription" },
      { status: 500 }
    );
  }
}
