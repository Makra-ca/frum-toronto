import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shiurim, shuls } from "@/lib/db/schema";
import { shiurSchema, TEACHER_TITLES } from "@/lib/validations/content";
import { eq, asc } from "drizzle-orm";

// Helper to build teacher name from parts
function buildTeacherName(title: string | null, firstName: string | null, lastName: string | null): string {
  const titleLabel = TEACHER_TITLES.find(t => t.value === title)?.label || "";
  const parts = [titleLabel, firstName, lastName].filter(Boolean);
  return parts.join(" ") || "Unknown Teacher";
}

// GET /api/admin/shiurim - List all shiurim
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const day = searchParams.get("day");
    const level = searchParams.get("level");
    const gender = searchParams.get("gender");
    const category = searchParams.get("category");

    const allShiurim = await db
      .select({
        id: shiurim.id,
        // Teacher info
        teacherTitle: shiurim.teacherTitle,
        teacherFirstName: shiurim.teacherFirstName,
        teacherLastName: shiurim.teacherLastName,
        teacherName: shiurim.teacherName,
        // Basic info
        title: shiurim.title,
        description: shiurim.description,
        // Location
        shulId: shiurim.shulId,
        shulName: shuls.name,
        locationName: shiurim.locationName,
        locationAddress: shiurim.locationAddress,
        locationPostalCode: shiurim.locationPostalCode,
        locationArea: shiurim.locationArea,
        location: shiurim.location,
        // Schedule
        schedule: shiurim.schedule,
        startDate: shiurim.startDate,
        endDate: shiurim.endDate,
        dayOfWeek: shiurim.dayOfWeek,
        time: shiurim.time,
        duration: shiurim.duration,
        // Classification
        category: shiurim.category,
        classType: shiurim.classType,
        level: shiurim.level,
        gender: shiurim.gender,
        // Contact
        contactName: shiurim.contactName,
        contactPhone: shiurim.contactPhone,
        contactEmail: shiurim.contactEmail,
        website: shiurim.website,
        // Additional
        cost: shiurim.cost,
        projectOf: shiurim.projectOf,
        submitterEmail: shiurim.submitterEmail,
        isOnHold: shiurim.isOnHold,
        isActive: shiurim.isActive,
        approvalStatus: shiurim.approvalStatus,
        createdAt: shiurim.createdAt,
      })
      .from(shiurim)
      .leftJoin(shuls, eq(shiurim.shulId, shuls.id))
      .orderBy(asc(shiurim.title));

    // Apply filters in memory (for flexibility)
    let filteredShiurim = allShiurim;

    if (day !== null && day !== "") {
      const dayNum = parseInt(day);
      filteredShiurim = filteredShiurim.filter((s) => {
        // Check legacy dayOfWeek field
        if (s.dayOfWeek === dayNum) return true;
        // Check schedule JSON
        if (s.schedule && typeof s.schedule === "object") {
          const sched = s.schedule as Record<string, { start?: string }>;
          return sched[day]?.start;
        }
        return false;
      });
    }

    if (level) {
      filteredShiurim = filteredShiurim.filter((s) => s.level === level);
    }

    if (gender) {
      filteredShiurim = filteredShiurim.filter((s) => s.gender === gender);
    }

    if (category) {
      filteredShiurim = filteredShiurim.filter((s) => s.category === category);
    }

    return NextResponse.json(filteredShiurim);
  } catch (error) {
    console.error("Error fetching shiurim:", error);
    return NextResponse.json(
      { error: "Failed to fetch shiurim" },
      { status: 500 }
    );
  }
}

// POST /api/admin/shiurim - Create a new shiur
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate with new schema
    const validatedData = shiurSchema.parse(body);

    // Build full teacher name for backward compatibility
    const teacherName = buildTeacherName(
      validatedData.teacherTitle || null,
      validatedData.teacherFirstName || null,
      validatedData.teacherLastName || null
    );

    // Handle shulId
    const shulId = validatedData.shulId || null;

    const [newShiur] = await db
      .insert(shiurim)
      .values({
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
        isActive: true,
        approvalStatus: "approved",
      })
      .returning();

    return NextResponse.json(newShiur, { status: 201 });
  } catch (error) {
    console.error("Error creating shiur:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid data", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create shiur" },
      { status: 500 }
    );
  }
}
