import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shuls, businesses, daveningSchedules } from "@/lib/db/schema";
import { shulSchema } from "@/lib/validations/content";
import { eq } from "drizzle-orm";

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
        email: businesses.email,
      })
      .from(shuls)
      .leftJoin(businesses, eq(shuls.businessId, businesses.id))
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

    // If changing business, check if new business already has a shul
    if (validatedData.businessId !== existingShul.businessId) {
      const [conflictingShul] = await db
        .select()
        .from(shuls)
        .where(eq(shuls.businessId, validatedData.businessId))
        .limit(1);

      if (conflictingShul) {
        return NextResponse.json(
          { error: "A shul already exists for this business" },
          { status: 400 }
        );
      }
    }

    const [updatedShul] = await db
      .update(shuls)
      .set({
        businessId: validatedData.businessId,
        rabbi: validatedData.rabbi,
        denomination: validatedData.denomination,
        nusach: validatedData.nusach,
        hasMinyan: validatedData.hasMinyan,
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
