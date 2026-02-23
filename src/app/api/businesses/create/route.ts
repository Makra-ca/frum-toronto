import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businesses, subscriptionPlans, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const createBusinessSchema = z.object({
  name: z.string().min(1, "Business name is required").max(200),
  categoryId: z.number().nullable().optional(),
  additionalCategoryIds: z.array(z.number()).optional(),
  description: z.string().max(5000).nullable().optional(),
  contactName: z.string().max(100).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().max(255).nullable().optional().or(z.literal("")),
  website: z.string().max(500).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  city: z.string().max(100).default("Toronto"),
  postalCode: z.string().max(20).nullable().optional(),
  isKosher: z.boolean().default(false),
  kosherCertification: z.string().max(100).nullable().optional(),
  hours: z
    .object({
      sunday: z.object({ open: z.string(), close: z.string() }).nullable().optional(),
      monday: z.object({ open: z.string(), close: z.string() }).nullable().optional(),
      tuesday: z.object({ open: z.string(), close: z.string() }).nullable().optional(),
      wednesday: z.object({ open: z.string(), close: z.string() }).nullable().optional(),
      thursday: z.object({ open: z.string(), close: z.string() }).nullable().optional(),
      friday: z.object({ open: z.string(), close: z.string() }).nullable().optional(),
      saturday: z.object({ open: z.string(), close: z.string() }).nullable().optional(),
    })
    .nullable()
    .optional(),
  socialLinks: z
    .object({
      facebook: z.string().optional(),
      instagram: z.string().optional(),
      twitter: z.string().optional(),
      linkedin: z.string().optional(),
    })
    .nullable()
    .optional(),
  subscriptionPlanId: z.number().optional(),
  // For paid plans - create with pending_payment status until PayPal confirms
  pendingPayment: z.boolean().optional(),
});

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function getUniqueSlug(baseName: string): Promise<string> {
  let slug = generateSlug(baseName);
  let counter = 1;

  while (true) {
    const existing = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.slug, slug))
      .limit(1);

    if (existing.length === 0) return slug;
    slug = `${generateSlug(baseName)}-${counter++}`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const result = createBusinessSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = result.data;
    const userId = parseInt(session.user.id);

    // Get the user to check if they're trusted
    const [user] = await db
      .select({ isTrusted: users.isTrusted })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Get the subscription plan
    let planId = data.subscriptionPlanId;
    if (!planId) {
      // Default to free plan
      const [freePlan] = await db
        .select({ id: subscriptionPlans.id })
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.slug, "free"))
        .limit(1);
      planId = freePlan?.id;
    }

    // Get the plan to validate features
    const [plan] = planId
      ? await db
          .select()
          .from(subscriptionPlans)
          .where(eq(subscriptionPlans.id, planId))
          .limit(1)
      : [null];

    // Validate against plan limits
    if (plan && plan.maxCategories !== null) {
      // Check category limit
      const categoryCount = 1 + (data.additionalCategoryIds?.length || 0);
      if (categoryCount > plan.maxCategories) {
        return NextResponse.json(
          { error: `Your plan only allows ${plan.maxCategories} categories` },
          { status: 400 }
        );
      }
    }

    const slug = await getUniqueSlug(data.name);

    // Determine approval status
    // pending_payment = waiting for PayPal (not visible anywhere)
    // pending = waiting for admin approval (visible to admin)
    // approved = live on site
    let approvalStatus: string;
    if (data.pendingPayment) {
      approvalStatus = "pending_payment";
    } else if (user?.isTrusted) {
      approvalStatus = "approved";
    } else {
      approvalStatus = "pending";
    }

    // Create the business
    const [newBusiness] = await db
      .insert(businesses)
      .values({
        name: data.name,
        slug,
        categoryId: data.categoryId || null,
        additionalCategoryIds: data.additionalCategoryIds || null,
        description: data.description || null,
        contactName: data.contactName || null,
        phone: data.phone || null,
        email: data.email || null,
        website: data.website || null,
        address: data.address || null,
        city: data.city || "Toronto",
        postalCode: data.postalCode || null,
        isKosher: data.isKosher,
        kosherCertification: data.kosherCertification || null,
        hours: data.hours || null,
        socialLinks: data.socialLinks || null,
        subscriptionPlanId: planId || null,
        userId,
        approvalStatus,
        isActive: true,
        viewCount: 0,
      })
      .returning();

    return NextResponse.json(
      {
        business: newBusiness,
        message: approvalStatus === "approved"
          ? "Business created and approved!"
          : "Business submitted for review. You'll be notified once approved.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API] Error creating business:", error);
    return NextResponse.json(
      { error: "Failed to create business" },
      { status: 500 }
    );
  }
}
