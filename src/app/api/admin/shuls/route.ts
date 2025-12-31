import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shuls, businesses } from "@/lib/db/schema";
import { shulSchema } from "@/lib/validations/content";
import { eq, desc } from "drizzle-orm";

// GET /api/admin/shuls - List all shuls with business info
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allShuls = await db
      .select({
        id: shuls.id,
        businessId: shuls.businessId,
        rabbi: shuls.rabbi,
        denomination: shuls.denomination,
        nusach: shuls.nusach,
        hasMinyan: shuls.hasMinyan,
        businessName: businesses.name,
        businessSlug: businesses.slug,
        address: businesses.address,
        phone: businesses.phone,
      })
      .from(shuls)
      .leftJoin(businesses, eq(shuls.businessId, businesses.id))
      .orderBy(desc(shuls.id));

    return NextResponse.json(allShuls);
  } catch (error) {
    console.error("Error fetching shuls:", error);
    return NextResponse.json(
      { error: "Failed to fetch shuls" },
      { status: 500 }
    );
  }
}

// POST /api/admin/shuls - Create a new shul
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = shulSchema.parse(body);

    // Check if business exists
    const business = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, validatedData.businessId))
      .limit(1);

    if (business.length === 0) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    // Check if shul already exists for this business
    const existingShul = await db
      .select()
      .from(shuls)
      .where(eq(shuls.businessId, validatedData.businessId))
      .limit(1);

    if (existingShul.length > 0) {
      return NextResponse.json(
        { error: "A shul already exists for this business" },
        { status: 400 }
      );
    }

    const [newShul] = await db
      .insert(shuls)
      .values({
        businessId: validatedData.businessId,
        rabbi: validatedData.rabbi,
        denomination: validatedData.denomination,
        nusach: validatedData.nusach,
        hasMinyan: validatedData.hasMinyan,
      })
      .returning();

    return NextResponse.json(newShul, { status: 201 });
  } catch (error) {
    console.error("Error creating shul:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid data", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create shul" },
      { status: 500 }
    );
  }
}
