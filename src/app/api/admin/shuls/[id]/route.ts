import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shuls, daveningSchedules } from "@/lib/db/schema";
import { shulSchema } from "@/lib/validations/content";
import { eq, and, ne } from "drizzle-orm";

// Helper function to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// GET /api/admin/shuls/[id] - Get single shul with davening schedules
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
    const shulId = parseInt(id);

    if (isNaN(shulId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const [shul] = await db
      .select()
      .from(shuls)
      .where(eq(shuls.id, shulId))
      .limit(1);

    if (!shul) {
      return NextResponse.json({ error: "Shul not found" }, { status: 404 });
    }

    // Get davening schedules
    const schedules = await db
      .select()
      .from(daveningSchedules)
      .where(eq(daveningSchedules.shulId, shulId));

    return NextResponse.json({ ...shul, daveningSchedules: schedules });
  } catch (error) {
    console.error("Error fetching shul:", error);
    return NextResponse.json(
      { error: "Failed to fetch shul" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/shuls/[id] - Update shul
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
    const shulId = parseInt(id);

    if (isNaN(shulId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const validatedData = shulSchema.parse(body);

    // Check if shul exists
    const [existingShul] = await db
      .select()
      .from(shuls)
      .where(eq(shuls.id, shulId))
      .limit(1);

    if (!existingShul) {
      return NextResponse.json({ error: "Shul not found" }, { status: 404 });
    }

    // Generate slug if name changed and no custom slug provided
    let slug = validatedData.slug || generateSlug(validatedData.name);

    // Check if slug already exists (for a different shul)
    if (slug !== existingShul.slug) {
      const [existingSlug] = await db
        .select({ id: shuls.id })
        .from(shuls)
        .where(and(eq(shuls.slug, slug), ne(shuls.id, shulId)))
        .limit(1);

      if (existingSlug) {
        slug = `${slug}-${Date.now()}`;
      }
    }

    const [updatedShul] = await db
      .update(shuls)
      .set({
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
        updatedAt: new Date(),
      })
      .where(eq(shuls.id, shulId))
      .returning();

    return NextResponse.json(updatedShul);
  } catch (error) {
    console.error("Error updating shul:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid data", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update shul" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/shuls/[id] - Delete shul
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
    const shulId = parseInt(id);

    if (isNaN(shulId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Check if shul exists
    const [existingShul] = await db
      .select()
      .from(shuls)
      .where(eq(shuls.id, shulId))
      .limit(1);

    if (!existingShul) {
      return NextResponse.json({ error: "Shul not found" }, { status: 404 });
    }

    // Delete shul (davening schedules will cascade delete)
    await db.delete(shuls).where(eq(shuls.id, shulId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting shul:", error);
    return NextResponse.json(
      { error: "Failed to delete shul" },
      { status: 500 }
    );
  }
}
