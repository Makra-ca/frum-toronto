import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { businessSubscriptions, businesses, subscriptionPlans } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyPayPalWebhookSignature, getPayPalSubscription } from "@/lib/paypal/config";

const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;

/**
 * POST /api/paypal/webhook
 *
 * Handles PayPal webhook events for subscriptions
 *
 * Important events:
 * - BILLING.SUBSCRIPTION.ACTIVATED - Subscription is active (first payment successful)
 * - BILLING.SUBSCRIPTION.CANCELLED - Subscription cancelled
 * - BILLING.SUBSCRIPTION.SUSPENDED - Subscription suspended (payment failed)
 * - BILLING.SUBSCRIPTION.EXPIRED - Subscription expired
 * - PAYMENT.SALE.COMPLETED - Recurring payment successful
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const event = JSON.parse(body);

    // Verify webhook signature in production
    if (PAYPAL_WEBHOOK_ID && process.env.NODE_ENV === "production") {
      const headers = {
        transmissionId: request.headers.get("paypal-transmission-id") || "",
        transmissionTime: request.headers.get("paypal-transmission-time") || "",
        certUrl: request.headers.get("paypal-cert-url") || "",
        authAlgo: request.headers.get("paypal-auth-algo") || "",
        transmissionSig: request.headers.get("paypal-transmission-sig") || "",
      };

      const isValid = await verifyPayPalWebhookSignature(
        PAYPAL_WEBHOOK_ID,
        headers,
        event
      );

      if (!isValid) {
        console.error("[PayPal Webhook] Invalid signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const eventType = event.event_type;
    const resource = event.resource;

    console.log(`[PayPal Webhook] Received event: ${eventType}`);

    switch (eventType) {
      case "BILLING.SUBSCRIPTION.ACTIVATED": {
        // Subscription is now active - first payment was successful
        await handleSubscriptionActivated(resource);
        break;
      }

      case "BILLING.SUBSCRIPTION.CANCELLED": {
        // Subscription was cancelled
        await handleSubscriptionCancelled(resource);
        break;
      }

      case "BILLING.SUBSCRIPTION.SUSPENDED": {
        // Subscription suspended (usually due to failed payment)
        await handleSubscriptionSuspended(resource);
        break;
      }

      case "BILLING.SUBSCRIPTION.EXPIRED": {
        // Subscription has expired
        await handleSubscriptionExpired(resource);
        break;
      }

      case "PAYMENT.SALE.COMPLETED": {
        // Recurring payment completed - extend subscription
        await handlePaymentCompleted(resource);
        break;
      }

      case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": {
        // Payment failed - could send notification to user
        await handlePaymentFailed(resource);
        break;
      }

      case "BILLING.SUBSCRIPTION.RE-ACTIVATED": {
        // Subscription reactivated after being suspended
        await handleSubscriptionReactivated(resource);
        break;
      }

      case "BILLING.SUBSCRIPTION.UPDATED": {
        // Subscription was updated (e.g., plan change)
        await handleSubscriptionUpdated(resource);
        break;
      }

      case "BILLING.SUBSCRIPTION.CREATED": {
        // Subscription created but not yet activated
        console.log(`[PayPal Webhook] Subscription created: ${resource.id}`);
        break;
      }

      default:
        console.log(`[PayPal Webhook] Unhandled event type: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[PayPal Webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

/**
 * Handle subscription activated - create or update business subscription
 */
async function handleSubscriptionActivated(resource: {
  id: string;
  plan_id: string;
  subscriber?: { payer_id: string };
  custom_id?: string;
  billing_info?: {
    next_billing_time?: string;
  };
}) {
  const subscriptionId = resource.id;
  const paypalPlanId = resource.plan_id;

  // Get custom data (businessId, userId, billingCycle)
  let customData: {
    businessId?: number;
    userId?: string;
    billingCycle?: "monthly" | "yearly";
  } = {};

  try {
    if (resource.custom_id) {
      customData = JSON.parse(resource.custom_id);
    }
  } catch {
    console.error("[PayPal Webhook] Failed to parse custom_id");
  }

  const { businessId, userId, billingCycle } = customData;

  if (!businessId || !userId) {
    console.error("[PayPal Webhook] Missing businessId or userId in custom data");
    return;
  }

  // Find the subscription plan by PayPal plan ID
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(
      billingCycle === "yearly"
        ? eq(subscriptionPlans.paypalPlanIdYearly, paypalPlanId)
        : eq(subscriptionPlans.paypalPlanIdMonthly, paypalPlanId)
    )
    .limit(1);

  if (!plan) {
    console.error("[PayPal Webhook] Could not find plan for PayPal plan ID:", paypalPlanId);
    return;
  }

  // Calculate subscription period
  const startDate = new Date();
  const endDate = new Date();
  if (billingCycle === "yearly") {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  // Create or update business subscription
  const existingSubscription = await db
    .select()
    .from(businessSubscriptions)
    .where(eq(businessSubscriptions.businessId, businessId))
    .limit(1);

  if (existingSubscription.length > 0) {
    // Update existing subscription
    await db
      .update(businessSubscriptions)
      .set({
        planId: plan.id,
        status: "active",
        paypalSubscriptionId: subscriptionId,
        paypalPayerId: resource.subscriber?.payer_id,
        billingCycle: billingCycle || "monthly",
        startDate,
        endDate,
        updatedAt: new Date(),
      })
      .where(eq(businessSubscriptions.businessId, businessId));
  } else {
    // Create new subscription
    await db.insert(businessSubscriptions).values({
      businessId,
      planId: plan.id,
      status: "active",
      paypalSubscriptionId: subscriptionId,
      paypalPayerId: resource.subscriber?.payer_id,
      billingCycle: billingCycle || "monthly",
      startDate,
      endDate,
    });
  }

  // Get current business to check status
  const [business] = await db
    .select({ approvalStatus: businesses.approvalStatus })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  // Update business with new subscription plan
  // If status is pending_payment, change to pending (awaiting admin approval)
  await db
    .update(businesses)
    .set({
      subscriptionPlanId: plan.id,
      ...(business?.approvalStatus === "pending_payment" ? { approvalStatus: "pending" } : {}),
    })
    .where(eq(businesses.id, businessId));

  console.log(`[PayPal Webhook] Subscription activated for business ${businessId}, plan: ${plan.name}`);
}

/**
 * Handle subscription cancelled
 */
async function handleSubscriptionCancelled(resource: { id: string }) {
  const subscriptionId = resource.id;

  // Find the subscription in our database
  const [subscription] = await db
    .select()
    .from(businessSubscriptions)
    .where(eq(businessSubscriptions.paypalSubscriptionId, subscriptionId))
    .limit(1);

  if (!subscription) {
    console.log("[PayPal Webhook] Cancelled subscription not found in DB:", subscriptionId);
    return;
  }

  // Update subscription status
  await db
    .update(businessSubscriptions)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(businessSubscriptions.id, subscription.id));

  // Downgrade business to free plan
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
      .where(eq(businesses.id, subscription.businessId));
  }

  console.log(`[PayPal Webhook] Subscription cancelled for business ${subscription.businessId}`);
}

/**
 * Handle subscription suspended (payment failed)
 */
async function handleSubscriptionSuspended(resource: { id: string }) {
  const subscriptionId = resource.id;

  await db
    .update(businessSubscriptions)
    .set({
      status: "suspended",
      updatedAt: new Date(),
    })
    .where(eq(businessSubscriptions.paypalSubscriptionId, subscriptionId));

  console.log(`[PayPal Webhook] Subscription suspended: ${subscriptionId}`);
}

/**
 * Handle subscription expired
 */
async function handleSubscriptionExpired(resource: { id: string }) {
  const subscriptionId = resource.id;

  const [subscription] = await db
    .select()
    .from(businessSubscriptions)
    .where(eq(businessSubscriptions.paypalSubscriptionId, subscriptionId))
    .limit(1);

  if (!subscription) return;

  // Update subscription status
  await db
    .update(businessSubscriptions)
    .set({
      status: "expired",
      updatedAt: new Date(),
    })
    .where(eq(businessSubscriptions.id, subscription.id));

  // Downgrade business to free plan
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
      .where(eq(businesses.id, subscription.businessId));
  }

  console.log(`[PayPal Webhook] Subscription expired for business ${subscription.businessId}`);
}

/**
 * Handle recurring payment completed - extend subscription
 */
async function handlePaymentCompleted(resource: {
  billing_agreement_id?: string;
  custom?: string;
}) {
  const subscriptionId = resource.billing_agreement_id;

  if (!subscriptionId) {
    console.log("[PayPal Webhook] Payment completed but no subscription ID");
    return;
  }

  // Get fresh subscription details from PayPal
  const paypalSubscription = await getPayPalSubscription(subscriptionId);

  if (!paypalSubscription) {
    console.error("[PayPal Webhook] Could not fetch subscription details");
    return;
  }

  const [subscription] = await db
    .select()
    .from(businessSubscriptions)
    .where(eq(businessSubscriptions.paypalSubscriptionId, subscriptionId))
    .limit(1);

  if (!subscription) return;

  // Extend subscription end date
  const billingCycle = subscription.billingCycle || "monthly";
  const newEndDate = new Date(subscription.endDate || new Date());

  if (billingCycle === "yearly") {
    newEndDate.setFullYear(newEndDate.getFullYear() + 1);
  } else {
    newEndDate.setMonth(newEndDate.getMonth() + 1);
  }

  await db
    .update(businessSubscriptions)
    .set({
      status: "active",
      endDate: newEndDate,
      updatedAt: new Date(),
    })
    .where(eq(businessSubscriptions.id, subscription.id));

  console.log(`[PayPal Webhook] Payment completed, subscription extended to ${newEndDate.toISOString()}`);
}

/**
 * Handle payment failed - mark subscription as having payment issues
 */
async function handlePaymentFailed(resource: { id: string }) {
  const subscriptionId = resource.id;

  const [subscription] = await db
    .select()
    .from(businessSubscriptions)
    .where(eq(businessSubscriptions.paypalSubscriptionId, subscriptionId))
    .limit(1);

  if (!subscription) {
    console.log("[PayPal Webhook] Payment failed for unknown subscription:", subscriptionId);
    return;
  }

  // Update subscription to reflect payment failure
  // Note: We don't immediately suspend - PayPal will send SUSPENDED event if it gives up
  await db
    .update(businessSubscriptions)
    .set({
      updatedAt: new Date(),
    })
    .where(eq(businessSubscriptions.id, subscription.id));

  // TODO: Could send email notification to user about payment failure
  console.log(`[PayPal Webhook] Payment failed for business ${subscription.businessId}`);
}

/**
 * Handle subscription reactivated - restore active status
 */
async function handleSubscriptionReactivated(resource: { id: string }) {
  const subscriptionId = resource.id;

  const [subscription] = await db
    .select()
    .from(businessSubscriptions)
    .where(eq(businessSubscriptions.paypalSubscriptionId, subscriptionId))
    .limit(1);

  if (!subscription) return;

  // Reactivate the subscription
  await db
    .update(businessSubscriptions)
    .set({
      status: "active",
      updatedAt: new Date(),
    })
    .where(eq(businessSubscriptions.id, subscription.id));

  console.log(`[PayPal Webhook] Subscription reactivated for business ${subscription.businessId}`);
}

/**
 * Handle subscription updated - plan changes etc.
 */
async function handleSubscriptionUpdated(resource: {
  id: string;
  plan_id?: string;
}) {
  const subscriptionId = resource.id;
  const newPlanId = resource.plan_id;

  const [subscription] = await db
    .select()
    .from(businessSubscriptions)
    .where(eq(businessSubscriptions.paypalSubscriptionId, subscriptionId))
    .limit(1);

  if (!subscription) return;

  // If plan changed, update the plan reference
  if (newPlanId) {
    // Find the plan in our database by PayPal plan ID
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(
        eq(subscriptionPlans.paypalPlanIdMonthly, newPlanId)
      )
      .limit(1);

    // Also check yearly plans
    if (!plan) {
      const [yearlyPlan] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.paypalPlanIdYearly, newPlanId))
        .limit(1);

      if (yearlyPlan) {
        await db
          .update(businessSubscriptions)
          .set({
            planId: yearlyPlan.id,
            billingCycle: "yearly",
            updatedAt: new Date(),
          })
          .where(eq(businessSubscriptions.id, subscription.id));

        // Also update the business's plan
        await db
          .update(businesses)
          .set({ subscriptionPlanId: yearlyPlan.id })
          .where(eq(businesses.id, subscription.businessId));
      }
    } else {
      await db
        .update(businessSubscriptions)
        .set({
          planId: plan.id,
          billingCycle: "monthly",
          updatedAt: new Date(),
        })
        .where(eq(businessSubscriptions.id, subscription.id));

      // Also update the business's plan
      await db
        .update(businesses)
        .set({ subscriptionPlanId: plan.id })
        .where(eq(businesses.id, subscription.businessId));
    }
  }

  console.log(`[PayPal Webhook] Subscription updated: ${subscriptionId}`);
}
