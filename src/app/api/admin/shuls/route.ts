import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shuls } from "@/lib/db/schema";
import { shulSchema } from "@/lib/validations/content";
import { desc, eq } from "drizzle-orm";

// Helper function to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .trim();
}

// GET /api/admin/shuls - List all shuls
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allShuls = await db
      .select()
      .from(shuls)
      .orderBy(desc(shuls.createdAt));

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

    // Generate slug if not provided
    let slug = validatedData.slug || generateSlug(validatedData.name);

    // Check if slug already exists and make unique if needed
    const existingSlug = await db
      .select({ id: shuls.id })
      .from(shuls)
      .where(eq(shuls.slug, slug))
      .limit(1);

    if (existingSlug.length > 0) {
      // Append timestamp to make unique
      slug = `${slug}-${Date.now()}`;
    }

    const [newShul] = await db
      .insert(shuls)
      .values({
        name: validatedData.name,
        slug,
        description: validatedData.description,
        address: validatedData.address,
        city: validatedData.city || "Toronto",
        postalCode: validatedData.postalCode,
        phone: validatedData.phone,
        email: validatedData.email || null,
        website: validatedData.website || null,
        rabbi: validatedData.rabbi,
        denomination: validatedData.denomination,
        nusach: validatedData.nusach,
        hasMinyan: validatedData.hasMinyan,
        isActive: true,
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
