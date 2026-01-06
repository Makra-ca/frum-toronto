import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import { businessSchema } from "@/lib/validations/content";
import { eq } from "drizzle-orm";

// GET /api/admin/businesses/[id] - Get single business
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
    const businessId = parseInt(id);

    if (isNaN(businessId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    return NextResponse.json(business);
  } catch (error) {
    console.error("Error fetching business:", error);
    return NextResponse.json(
      { error: "Failed to fetch business" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/businesses/[id] - Update business
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
    const businessId = parseInt(id);

    if (isNaN(businessId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Check if business exists
    const [existingBusiness] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!existingBusiness) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = businessSchema.parse(body);

    const [updatedBusiness] = await db
      .update(businesses)
      .set({
        name: validatedData.name,
        categoryId: validatedData.categoryId,
        description: validatedData.description,
        address: validatedData.address,
        city: validatedData.city || "Toronto",
        postalCode: validatedData.postalCode,
        phone: validatedData.phone,
        email: validatedData.email || null,
        website: validatedData.website,
        isKosher: validatedData.isKosher,
        kosherCertification: validatedData.kosherCertification,
        hours: validatedData.hours,
        isFeatured: validatedData.isFeatured,
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, businessId))
      .returning();

    return NextResponse.json(updatedBusiness);
  } catch (error) {
    console.error("Error updating business:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid data", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update business" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/businesses/[id] - Delete business
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const businessId = parseInt(id);

    if (isNaN(businessId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Check if business exists
    const [existingBusiness] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!existingBusiness) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    await db.delete(businesses).where(eq(businesses.id, businessId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting business:", error);
    return NextResponse.json(
      { error: "Failed to delete business" },
      { status: 500 }
    );
  }
}
