/**
 * PayPal Configuration and API Helpers
 *
 * Uses PayPal REST API v2 for Subscriptions
 * https://developer.paypal.com/docs/api/subscriptions/v1/
 *
 * Set PAYPAL_MODE=sandbox or PAYPAL_MODE=live in .env
 */

const PAYPAL_MODE = process.env.PAYPAL_MODE || "sandbox";
const isSandbox = PAYPAL_MODE === "sandbox";

// Auto-select credentials based on mode
const PAYPAL_CLIENT_ID = isSandbox
  ? process.env.PAYPAL_SANDBOX_CLIENT_ID
  : process.env.PAYPAL_LIVE_CLIENT_ID;

const PAYPAL_CLIENT_SECRET = isSandbox
  ? process.env.PAYPAL_SANDBOX_CLIENT_SECRET
  : process.env.PAYPAL_LIVE_CLIENT_SECRET;

// API base URLs
const PAYPAL_API_BASE = isSandbox
  ? "https://api-m.sandbox.paypal.com"
  : "https://api-m.paypal.com";

// Check if PayPal is configured
export function isPayPalConfigured(): boolean {
  return !!(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET);
}

/**
 * Get PayPal OAuth access token
 */
export async function getPayPalAccessToken(): Promise<string | null> {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    console.error("[PayPal] Client ID or Secret not configured");
    return null;
  }

  try {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");

    const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[PayPal] Failed to get access token:", error);
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("[PayPal] Error getting access token:", error);
    return null;
  }
}

/**
 * Create a subscription for a user
 * Returns the subscription ID and approval URL
 */
export async function createPayPalSubscription(
  planId: string,
  returnUrl: string,
  cancelUrl: string,
  customData?: {
    businessId?: number;
    userId?: string;
    billingCycle?: "monthly" | "yearly";
  }
): Promise<{
  subscriptionId: string;
  approvalUrl: string;
} | null> {
  const accessToken = await getPayPalAccessToken();
  if (!accessToken) return null;

  try {
    const response = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        plan_id: planId,
        application_context: {
          brand_name: "FrumToronto",
          locale: "en-US",
          shipping_preference: "NO_SHIPPING",
          user_action: "SUBSCRIBE_NOW",
          payment_method: {
            payer_selected: "PAYPAL",
            payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED",
          },
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
        custom_id: customData ? JSON.stringify(customData) : undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[PayPal] Failed to create subscription:", error);
      return null;
    }

    const subscription = await response.json();

    // Find the approval link
    const approvalLink = subscription.links?.find(
      (link: { rel: string; href: string }) => link.rel === "approve"
    );

    if (!approvalLink) {
      console.error("[PayPal] No approval link found in subscription response");
      return null;
    }

    return {
      subscriptionId: subscription.id,
      approvalUrl: approvalLink.href,
    };
  } catch (error) {
    console.error("[PayPal] Error creating subscription:", error);
    return null;
  }
}

/**
 * Get subscription details from PayPal
 */
export async function getPayPalSubscription(subscriptionId: string): Promise<{
  id: string;
  status: string;
  planId: string;
  startTime: string;
  billingInfo?: {
    nextBillingTime: string;
    lastPayment?: {
      amount: { value: string; currency_code: string };
      time: string;
    };
  };
  subscriber?: {
    emailAddress: string;
    payerId: string;
  };
  customId?: string;
} | null> {
  const accessToken = await getPayPalAccessToken();
  if (!accessToken) return null;

  try {
    const response = await fetch(
      `${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[PayPal] Failed to get subscription:", error);
      return null;
    }

    const subscription = await response.json();

    return {
      id: subscription.id,
      status: subscription.status, // APPROVAL_PENDING, APPROVED, ACTIVE, SUSPENDED, CANCELLED, EXPIRED
      planId: subscription.plan_id,
      startTime: subscription.start_time,
      billingInfo: subscription.billing_info ? {
        nextBillingTime: subscription.billing_info.next_billing_time,
        lastPayment: subscription.billing_info.last_payment ? {
          amount: subscription.billing_info.last_payment.amount,
          time: subscription.billing_info.last_payment.time,
        } : undefined,
      } : undefined,
      subscriber: subscription.subscriber ? {
        emailAddress: subscription.subscriber.email_address,
        payerId: subscription.subscriber.payer_id,
      } : undefined,
      customId: subscription.custom_id,
    };
  } catch (error) {
    console.error("[PayPal] Error getting subscription:", error);
    return null;
  }
}

/**
 * Cancel a subscription
 */
export async function cancelPayPalSubscription(
  subscriptionId: string,
  reason: string = "Cancelled by user"
): Promise<boolean> {
  const accessToken = await getPayPalAccessToken();
  if (!accessToken) return false;

  try {
    const response = await fetch(
      `${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}/cancel`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      }
    );

    // 204 No Content = success
    if (response.status === 204) {
      return true;
    }

    const error = await response.text();
    console.error("[PayPal] Failed to cancel subscription:", error);
    return false;
  } catch (error) {
    console.error("[PayPal] Error cancelling subscription:", error);
    return false;
  }
}

/**
 * Suspend a subscription (temporarily pause billing)
 */
export async function suspendPayPalSubscription(
  subscriptionId: string,
  reason: string = "Suspended by admin"
): Promise<boolean> {
  const accessToken = await getPayPalAccessToken();
  if (!accessToken) return false;

  try {
    const response = await fetch(
      `${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}/suspend`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      }
    );

    if (response.status === 204) {
      return true;
    }

    const error = await response.text();
    console.error("[PayPal] Failed to suspend subscription:", error);
    return false;
  } catch (error) {
    console.error("[PayPal] Error suspending subscription:", error);
    return false;
  }
}

/**
 * Reactivate a suspended subscription
 */
export async function reactivatePayPalSubscription(
  subscriptionId: string,
  reason: string = "Reactivated by admin"
): Promise<boolean> {
  const accessToken = await getPayPalAccessToken();
  if (!accessToken) return false;

  try {
    const response = await fetch(
      `${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}/activate`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      }
    );

    if (response.status === 204) {
      return true;
    }

    const error = await response.text();
    console.error("[PayPal] Failed to reactivate subscription:", error);
    return false;
  } catch (error) {
    console.error("[PayPal] Error reactivating subscription:", error);
    return false;
  }
}

/**
 * Verify webhook signature from PayPal
 */
export async function verifyPayPalWebhookSignature(
  webhookId: string,
  headers: {
    transmissionId: string;
    transmissionTime: string;
    certUrl: string;
    authAlgo: string;
    transmissionSig: string;
  },
  webhookEvent: object
): Promise<boolean> {
  const accessToken = await getPayPalAccessToken();
  if (!accessToken) return false;

  try {
    const response = await fetch(
      `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auth_algo: headers.authAlgo,
          cert_url: headers.certUrl,
          transmission_id: headers.transmissionId,
          transmission_sig: headers.transmissionSig,
          transmission_time: headers.transmissionTime,
          webhook_id: webhookId,
          webhook_event: webhookEvent,
        }),
      }
    );

    if (!response.ok) {
      console.error("[PayPal] Webhook verification failed");
      return false;
    }

    const result = await response.json();
    return result.verification_status === "SUCCESS";
  } catch (error) {
    console.error("[PayPal] Error verifying webhook:", error);
    return false;
  }
}

/**
 * Create a PayPal product (catalog item)
 * Products are the container for plans
 */
export async function createPayPalProduct(
  name: string,
  description: string
): Promise<{ id: string; name: string } | null> {
  const accessToken = await getPayPalAccessToken();
  if (!accessToken) return null;

  try {
    const response = await fetch(`${PAYPAL_API_BASE}/v1/catalogs/products`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        name,
        description,
        type: "SERVICE",
        category: "SOFTWARE",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[PayPal] Failed to create product:", error);
      return null;
    }

    const product = await response.json();
    return { id: product.id, name: product.name };
  } catch (error) {
    console.error("[PayPal] Error creating product:", error);
    return null;
  }
}

/**
 * Get existing PayPal products
 */
export async function getPayPalProducts(): Promise<Array<{ id: string; name: string }> | null> {
  const accessToken = await getPayPalAccessToken();
  if (!accessToken) return null;

  try {
    const response = await fetch(`${PAYPAL_API_BASE}/v1/catalogs/products?page_size=20`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[PayPal] Failed to get products:", error);
      return null;
    }

    const data = await response.json();
    return data.products || [];
  } catch (error) {
    console.error("[PayPal] Error getting products:", error);
    return null;
  }
}

/**
 * Create a PayPal billing plan
 */
export async function createPayPalPlan(
  productId: string,
  planName: string,
  description: string,
  price: string,
  interval: "MONTH" | "YEAR"
): Promise<{ id: string; name: string; status: string } | null> {
  const accessToken = await getPayPalAccessToken();
  if (!accessToken) return null;

  try {
    const response = await fetch(`${PAYPAL_API_BASE}/v1/billing/plans`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        product_id: productId,
        name: planName,
        description,
        status: "ACTIVE",
        billing_cycles: [
          {
            frequency: {
              interval_unit: interval,
              interval_count: 1,
            },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 0, // 0 = infinite
            pricing_scheme: {
              fixed_price: {
                value: price,
                currency_code: "CAD",
              },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee_failure_action: "CONTINUE",
          payment_failure_threshold: 3,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[PayPal] Failed to create plan:", error);
      return null;
    }

    const plan = await response.json();
    return { id: plan.id, name: plan.name, status: plan.status };
  } catch (error) {
    console.error("[PayPal] Error creating plan:", error);
    return null;
  }
}

/**
 * Get current PayPal mode
 */
export function getPayPalMode(): "sandbox" | "live" {
  return PAYPAL_MODE as "sandbox" | "live";
}

// Export config for client-side use
export const paypalConfig = {
  clientId: PAYPAL_CLIENT_ID || "",
  mode: PAYPAL_MODE as "sandbox" | "live",
};
