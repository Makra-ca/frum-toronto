import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businesses, businessCategories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = parseInt(session.user.id);

  const userBusinesses = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      slug: businesses.slug,
      description: businesses.description,
      address: businesses.address,
      city: businesses.city,
      phone: businesses.phone,
      website: businesses.website,
      logoUrl: businesses.logoUrl,
      isKosher: businesses.isKosher,
      approvalStatus: businesses.approvalStatus,
      isActive: businesses.isActive,
      viewCount: businesses.viewCount,
      createdAt: businesses.createdAt,
      categoryName: businessCategories.name,
      categorySlug: businessCategories.slug,
    })
    .from(businesses)
    .leftJoin(businessCategories, eq(businesses.categoryId, businessCategories.id))
    .where(eq(businesses.userId, userId));

  return NextResponse.json(userBusinesses);
}
