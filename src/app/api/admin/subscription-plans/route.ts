import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { subscriptionPlans } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

const createPlanSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z.string().min(1).max(50),
  description: z.string().optional().nullable(),
  priceMonthly: z.string().optional().nullable(),
  priceYearly: z.string().optional().nullable(),
  maxCategories: z.number().int().min(1).default(1),
  maxPhotos: z.number().int().min(0).default(0),
  showDescription: z.boolean().default(false),
  showContactName: z.boolean().default(false),
  showEmail: z.boolean().default(false),
  showWebsite: z.boolean().default(false),
  showHours: z.boolean().default(false),
  showMap: z.boolean().default(false),
  showLogo: z.boolean().default(false),
  showSocialLinks: z.boolean().default(false),
  showKosherBadge: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  priorityInSearch: z.boolean().default(false),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

// GET - List all subscription plans
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const plans = await db
      .select()
      .from(subscriptionPlans)
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

// POST - Create a new subscription plan
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const result = createPlanSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = result.data;

    // Check for duplicate slug
    const existing = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.slug, data.slug))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "A plan with this slug already exists" },
        { status: 400 }
      );
    }

    // Create the plan
    const [newPlan] = await db
      .insert(subscriptionPlans)
      .values({
        name: data.name,
        slug: data.slug,
        description: data.description,
        priceMonthly: data.priceMonthly,
        priceYearly: data.priceYearly,
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
        displayOrder: data.displayOrder,
        isActive: data.isActive,
      })
      .returning();

    return NextResponse.json(newPlan, { status: 201 });
  } catch (error) {
    console.error("Error creating subscription plan:", error);
    return NextResponse.json(
      { error: "Failed to create subscription plan" },
      { status: 500 }
    );
  }
}
