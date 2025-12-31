import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shiurim } from "@/lib/db/schema";
import { shiurSchema, TEACHER_TITLES } from "@/lib/validations/content";
import { eq } from "drizzle-orm";

// Helper to build teacher name from parts
function buildTeacherName(title: string | null, firstName: string | null, lastName: string | null): string {
  const titleLabel = TEACHER_TITLES.find(t => t.value === title)?.label || "";
  const parts = [titleLabel, firstName, lastName].filter(Boolean);
  return parts.join(" ") || "Unknown Teacher";
}

// GET /api/admin/shiurim/[id] - Get single shiur
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
    const shiurId = parseInt(id);

    if (isNaN(shiurId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const [shiur] = await db
      .select()
      .from(shiurim)
      .where(eq(shiurim.id, shiurId))
      .limit(1);

    if (!shiur) {
      return NextResponse.json({ error: "Shiur not found" }, { status: 404 });
    }

    return NextResponse.json(shiur);
  } catch (error) {
    console.error("Error fetching shiur:", error);
    return NextResponse.json(
      { error: "Failed to fetch shiur" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/shiurim/[id] - Update shiur
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
    const shiurId = parseInt(id);

    if (isNaN(shiurId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Check if shiur exists
    const [existingShiur] = await db
      .select()
      .from(shiurim)
      .where(eq(shiurim.id, shiurId))
      .limit(1);

    if (!existingShiur) {
      return NextResponse.json({ error: "Shiur not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = shiurSchema.parse(body);

    // Build full teacher name for backward compatibility
    const teacherName = buildTeacherName(
      validatedData.teacherTitle || null,
      validatedData.teacherFirstName || null,
      validatedData.teacherLastName || null
    );

    // Handle shulId
    const shulId = validatedData.shulId || null;

    const [updatedShiur] = await db
      .update(shiurim)
      .set({
        // Teacher info
        teacherTitle: validatedData.teacherTitle || null,
        teacherFirstName: validatedData.teacherFirstName || null,
        teacherLastName: validatedData.teacherLastName || null,
        teacherName: teacherName,
        // Basic info
        title: validatedData.title,
        description: validatedData.description || null,
        // Location
        shulId: shulId,
        locationName: validatedData.locationName || null,
        locationAddress: validatedData.locationAddress || null,
        locationPostalCode: validatedData.locationPostalCode || null,
        locationArea: validatedData.locationArea || null,
        // Schedule
        schedule: validatedData.schedule || null,
        startDate: validatedData.startDate || null,
        endDate: validatedData.endDate || null,
        // Classification
        category: validatedData.category || null,
        classType: validatedData.classType || null,
        level: validatedData.level || null,
        gender: validatedData.gender || null,
        // Contact
        contactName: validatedData.contactName || null,
        contactPhone: validatedData.contactPhone || null,
        contactEmail: validatedData.contactEmail || null,
        website: validatedData.website || null,
        // Additional
        cost: validatedData.cost || null,
        projectOf: validatedData.projectOf || null,
        submitterEmail: validatedData.submitterEmail || null,
        isOnHold: validatedData.isOnHold || false,
        updatedAt: new Date(),
      })
      .where(eq(shiurim.id, shiurId))
      .returning();

    return NextResponse.json(updatedShiur);
  } catch (error) {
    console.error("Error updating shiur:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid data", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update shiur" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/shiurim/[id] - Delete shiur
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
    const shiurId = parseInt(id);

    if (isNaN(shiurId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Check if shiur exists
    const [existingShiur] = await db
      .select()
      .from(shiurim)
      .where(eq(shiurim.id, shiurId))
      .limit(1);

    if (!existingShiur) {
      return NextResponse.json({ error: "Shiur not found" }, { status: 404 });
    }

    await db.delete(shiurim).where(eq(shiurim.id, shiurId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting shiur:", error);
    return NextResponse.json(
      { error: "Failed to delete shiur" },
      { status: 500 }
    );
  }
}
