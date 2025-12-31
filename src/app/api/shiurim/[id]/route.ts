import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shiurim, shuls, businesses } from "@/lib/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";

// GET /api/shiurim/[id] - Get single shiur for public view
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shiurId = parseInt(id);

    if (isNaN(shiurId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const [shiur] = await db
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
        shulName: businesses.name,
        shulSlug: businesses.slug,
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
        isActive: shiurim.isActive,
        isOnHold: shiurim.isOnHold,
      })
      .from(shiurim)
      .leftJoin(shuls, eq(shiurim.shulId, shuls.id))
      .leftJoin(businesses, eq(shuls.businessId, businesses.id))
      .where(
        and(
          eq(shiurim.id, shiurId),
          eq(shiurim.isActive, true),
          or(eq(shiurim.isOnHold, false), isNull(shiurim.isOnHold))
        )
      )
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
