import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { subscriptionPlans, siteSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  createPayPalProduct,
  createPayPalPlan,
  getPayPalProducts,
  getPayPalMode,
  isPayPalConfigured,
} from "@/lib/paypal/config";

const PRODUCT_NAME = "FrumToronto Business Listing";
const PRODUCT_DESCRIPTION = "Business directory listing subscription for FrumToronto";

// Helper to get setting from database
async function getSetting(key: string): Promise<string | null> {
  const [setting] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.key, key))
    .limit(1);
  return setting?.value || null;
}

// Helper to save setting to database
async function saveSetting(key: string, value: string, description?: string): Promise<void> {
  const existing = await getSetting(key);
  if (existing !== null) {
    await db
      .update(siteSettings)
      .set({ value, updatedAt: new Date() })
      .where(eq(siteSettings.key, key));
  } else {
    await db.insert(siteSettings).values({ key, value, description });
  }
}

/**
 * POST /api/admin/subscription-plans/sync-paypal
 *
 * Syncs subscription plans to PayPal:
 * 1. Creates a product if it doesn't exist
 * 2. Creates plans for each paid subscription tier
 * 3. Stores the plan IDs in the database
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if PayPal is configured
    if (!isPayPalConfigured()) {
      return NextResponse.json(
        { error: "PayPal is not configured. Check your environment variables." },
        { status: 400 }
      );
    }

    const mode = getPayPalMode();
    const results: Array<{
      planId: number;
      planName: string;
      action: string;
      paypalPlanIdMonthly?: string;
      paypalPlanIdYearly?: string;
      error?: string;
    }> = [];

    // Step 1: Get or create PayPal product
    let productId: string | null = null;
    const productIdKey = mode === "sandbox"
      ? "paypal_sandbox_product_id"
      : "paypal_live_product_id";

    // Check database first
    const storedProductId = await getSetting(productIdKey);

    if (storedProductId) {
      productId = storedProductId;
      console.log(`[PayPal Sync] Using existing product ID from database: ${productId}`);
    } else {
      // Try to find existing product in PayPal or create new one
      const existingProducts = await getPayPalProducts();
      const existingProduct = existingProducts?.find(p => p.name === PRODUCT_NAME);

      if (existingProduct) {
        productId = existingProduct.id;
        console.log(`[PayPal Sync] Found existing product in PayPal: ${productId}`);
      } else {
        // Create new product
        const newProduct = await createPayPalProduct(PRODUCT_NAME, PRODUCT_DESCRIPTION);
        if (!newProduct) {
          return NextResponse.json(
            { error: "Failed to create PayPal product" },
            { status: 500 }
          );
        }
        productId = newProduct.id;
        console.log(`[PayPal Sync] Created new product: ${productId}`);
      }

      // Save product ID to database
      await saveSetting(
        productIdKey,
        productId,
        `PayPal ${mode} product ID for business listings`
      );
      console.log(`[PayPal Sync] Saved product ID to database`);
    }

    // Step 2: Get all paid subscription plans
    const plans = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true));

    // Step 3: Create PayPal plans for each paid tier
    for (const plan of plans) {
      // Skip free plans
      const monthlyPrice = parseFloat(plan.priceMonthly || "0");
      const yearlyPrice = parseFloat(plan.priceYearly || "0");

      if (monthlyPrice === 0 && yearlyPrice === 0) {
        results.push({
          planId: plan.id,
          planName: plan.name,
          action: "skipped (free plan)",
        });
        continue;
      }

      // Check if plans already exist for current mode
      const existingMonthlyId = mode === "sandbox"
        ? plan.paypalPlanIdMonthlySandbox
        : plan.paypalPlanIdMonthly;
      const existingYearlyId = mode === "sandbox"
        ? plan.paypalPlanIdYearlySandbox
        : plan.paypalPlanIdYearly;

      let newMonthlyId: string | null = existingMonthlyId;
      let newYearlyId: string | null = existingYearlyId;
      const actions: string[] = [];

      // Create monthly plan if needed and price > 0
      if (!existingMonthlyId && monthlyPrice > 0) {
        const monthlyPlan = await createPayPalPlan(
          productId,
          `${plan.name} - Monthly`,
          plan.description || `${plan.name} monthly subscription`,
          monthlyPrice.toFixed(2),
          "MONTH"
        );

        if (monthlyPlan) {
          newMonthlyId = monthlyPlan.id;
          actions.push(`created monthly plan: ${monthlyPlan.id}`);
        } else {
          results.push({
            planId: plan.id,
            planName: plan.name,
            action: "error",
            error: "Failed to create monthly plan",
          });
          continue;
        }
      } else if (existingMonthlyId) {
        actions.push("monthly plan exists");
      }

      // Create yearly plan if needed and price > 0
      if (!existingYearlyId && yearlyPrice > 0) {
        const yearlyPlan = await createPayPalPlan(
          productId,
          `${plan.name} - Yearly`,
          plan.description || `${plan.name} yearly subscription`,
          yearlyPrice.toFixed(2),
          "YEAR"
        );

        if (yearlyPlan) {
          newYearlyId = yearlyPlan.id;
          actions.push(`created yearly plan: ${yearlyPlan.id}`);
        } else {
          results.push({
            planId: plan.id,
            planName: plan.name,
            action: "error",
            error: "Failed to create yearly plan",
          });
          continue;
        }
      } else if (existingYearlyId) {
        actions.push("yearly plan exists");
      }

      // Update database with new plan IDs
      const updateData = mode === "sandbox"
        ? {
            paypalPlanIdMonthlySandbox: newMonthlyId,
            paypalPlanIdYearlySandbox: newYearlyId,
          }
        : {
            paypalPlanIdMonthly: newMonthlyId,
            paypalPlanIdYearly: newYearlyId,
          };

      await db
        .update(subscriptionPlans)
        .set(updateData)
        .where(eq(subscriptionPlans.id, plan.id));

      results.push({
        planId: plan.id,
        planName: plan.name,
        action: actions.join(", ") || "no changes",
        paypalPlanIdMonthly: newMonthlyId || undefined,
        paypalPlanIdYearly: newYearlyId || undefined,
      });
    }

    return NextResponse.json({
      success: true,
      mode,
      productId,
      productIdSaved: true, // Product ID is auto-saved to database
      results,
    });
  } catch (error) {
    console.error("[PayPal Sync] Error:", error);
    return NextResponse.json(
      { error: "Failed to sync plans to PayPal" },
      { status: 500 }
    );
  }
}
