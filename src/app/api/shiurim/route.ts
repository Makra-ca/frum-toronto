import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shiurim, shuls } from "@/lib/db/schema";
import { eq, and, asc, isNull, or } from "drizzle-orm";

interface ScheduleEntry {
  start?: string;
  end?: string;
  notes?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const day = searchParams.get("day");
    const level = searchParams.get("level");
    const gender = searchParams.get("gender");
    const category = searchParams.get("category");

    // Fetch all active shiurim that are not on hold
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
      })
      .from(shiurim)
      .leftJoin(shuls, eq(shiurim.shulId, shuls.id))
      .where(
        and(
          eq(shiurim.isActive, true),
          or(eq(shiurim.isOnHold, false), isNull(shiurim.isOnHold))
        )
      )
      .orderBy(asc(shiurim.title));

    // Apply filters in memory for flexibility with schedule JSON
    let filteredShiurim = allShiurim;

    // Filter by day - check both legacy dayOfWeek and new schedule JSON
    if (day !== null && day !== "") {
      const dayNum = parseInt(day);
      filteredShiurim = filteredShiurim.filter((s) => {
        // Check legacy dayOfWeek field
        if (s.dayOfWeek === dayNum) return true;
        // Check schedule JSON
        if (s.schedule && typeof s.schedule === "object") {
          const sched = s.schedule as Record<string, ScheduleEntry>;
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
