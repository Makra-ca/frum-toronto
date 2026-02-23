import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { subscriptionPlans, businesses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createPayPalSubscription, isPayPalConfigured } from "@/lib/paypal/config";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * POST /api/paypal/create-subscription
 *
 * Creates a PayPal subscription for a business listing
 *
 * Body:
 * - planId: number (subscription plan ID from our DB)
 * - businessId: number (business to upgrade)
 * - billingCycle: "monthly" | "yearly"
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check PayPal configuration
    if (!isPayPalConfigured()) {
      return NextResponse.json(
        { error: "Payment system not configured" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { planId, businessId, billingCycle } = body;

    // Validate inputs
    if (!planId || !businessId || !billingCycle) {
      return NextResponse.json(
        { error: "Missing required fields: planId, businessId, billingCycle" },
        { status: 400 }
      );
    }

    if (!["monthly", "yearly"].includes(billingCycle)) {
      return NextResponse.json(
        { error: "Invalid billing cycle. Must be 'monthly' or 'yearly'" },
        { status: 400 }
      );
    }

    // Get the subscription plan
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (!plan.isActive) {
      return NextResponse.json(
        { error: "This plan is no longer available" },
        { status: 400 }
      );
    }

    // Get the PayPal plan ID based on billing cycle
    const paypalPlanId = billingCycle === "monthly"
      ? plan.paypalPlanIdMonthly
      : plan.paypalPlanIdYearly;

    if (!paypalPlanId) {
      return NextResponse.json(
        { error: "PayPal plan not configured for this billing cycle" },
        { status: 400 }
      );
    }

    // Verify the business exists and belongs to the user (or user is admin)
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Check ownership (user must own the business or be admin)
    const isAdmin = session.user.role === "admin";
    const isOwner = business.userId === session.user.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "You don't have permission to upgrade this business" },
        { status: 403 }
      );
    }

    // Create PayPal subscription
    const result = await createPayPalSubscription(
      paypalPlanId,
      `${APP_URL}/dashboard/business/${businessId}/subscription-success`,
      `${APP_URL}/dashboard/business/${businessId}/subscription-cancelled`,
      {
        businessId,
        userId: session.user.id,
        billingCycle,
      }
    );

    if (!result) {
      return NextResponse.json(
        { error: "Failed to create subscription with PayPal" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      subscriptionId: result.subscriptionId,
      approvalUrl: result.approvalUrl,
    });
  } catch (error) {
    console.error("[PayPal] Error creating subscription:", error);
    return NextResponse.json(
      { error: "Failed to create subscription" },
      { status: 500 }
    );
  }
}
