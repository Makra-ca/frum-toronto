import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { subscriptionPlans } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updatePlanSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  priceMonthly: z.string().nullable().optional(),
  priceYearly: z.string().nullable().optional(),
  maxCategories: z.number().int().min(1).max(10),
  maxPhotos: z.number().int().min(0).max(999),
  showDescription: z.boolean(),
  showContactName: z.boolean(),
  showEmail: z.boolean(),
  showWebsite: z.boolean(),
  showHours: z.boolean(),
  showMap: z.boolean(),
  showLogo: z.boolean(),
  showSocialLinks: z.boolean(),
  showKosherBadge: z.boolean(),
  isFeatured: z.boolean(),
  priorityInSearch: z.boolean(),
  paypalPlanIdMonthly: z.string().max(100).nullable().optional(),
  paypalPlanIdYearly: z.string().max(100).nullable().optional(),
  isActive: z.boolean(),
});

// GET - Get single plan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const planId = parseInt(id);

    if (isNaN(planId)) {
      return NextResponse.json({ error: "Invalid plan ID" }, { status: 400 });
    }

    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json(plan);
  } catch (error) {
    console.error("Error fetching plan:", error);
    return NextResponse.json(
      { error: "Failed to fetch plan" },
      { status: 500 }
    );
  }
}

// PUT - Update plan
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const planId = parseInt(id);

    if (isNaN(planId)) {
      return NextResponse.json({ error: "Invalid plan ID" }, { status: 400 });
    }

    const body = await request.json();
    const result = updatePlanSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = result.data;

    // Check if plan exists
    const [existing] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Update the plan
    const [updated] = await db
      .update(subscriptionPlans)
      .set({
        name: data.name,
        description: data.description || null,
        priceMonthly: data.priceMonthly || null,
        priceYearly: data.priceYearly || null,
        maxCategories: data.maxCategories,
        maxPhotos: data.maxPhotos,
        showDescription: data.showDescription,
        showContactName: data.showContactName,
        showEmail: data.showEmail,
        showWebsite: data.showWebsite,
        showHours: data.showHours,
        showMap: data.showMap,
        showLogo: data.showLogo,
        showSocialLinks: data.showSocialLinks,
        showKosherBadge: data.showKosherBadge,
        isFeatured: data.isFeatured,
        priorityInSearch: data.priorityInSearch,
        paypalPlanIdMonthly: data.paypalPlanIdMonthly || null,
        paypalPlanIdYearly: data.paypalPlanIdYearly || null,
        isActive: data.isActive,
      })
      .where(eq(subscriptionPlans.id, planId))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating plan:", error);
    return NextResponse.json(
      { error: "Failed to update plan" },
      { status: 500 }
    );
  }
}
