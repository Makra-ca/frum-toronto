import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shiurim, shuls, users } from "@/lib/db/schema";
import { eq, and, asc, isNull, or } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";

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
    const area = searchParams.get("area");
    const teacher = searchParams.get("teacher");
    const organization = searchParams.get("organization");
    const getFilters = searchParams.get("filters") === "true";

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

    // If filters requested, extract distinct values from existing data
    if (getFilters) {
      const days = new Set<number>();
      const categories = new Set<string>();
      const levels = new Set<string>();
      const genders = new Set<string>();
      const areas = new Set<string>();
      const teachers = new Set<string>();
      const organizations = new Set<string>();

      allShiurim.forEach((s) => {
        // Extract days from schedule or legacy dayOfWeek
        if (s.dayOfWeek !== null) days.add(s.dayOfWeek);
        if (s.schedule && typeof s.schedule === "object") {
          const sched = s.schedule as Record<string, ScheduleEntry>;
          Object.keys(sched).forEach((dayKey) => {
            if (sched[dayKey]?.start) days.add(parseInt(dayKey));
          });
        }
        if (s.category) categories.add(s.category);
        if (s.level) levels.add(s.level);
        if (s.gender) genders.add(s.gender);
        if (s.locationArea) areas.add(s.locationArea);
        if (s.teacherName) teachers.add(s.teacherName);
        if (s.projectOf) organizations.add(s.projectOf);
      });

      return NextResponse.json({
        days: Array.from(days).sort((a, b) => a - b),
        categories: Array.from(categories).sort(),
        levels: Array.from(levels).sort(),
        genders: Array.from(genders).sort(),
        areas: Array.from(areas).sort(),
        teachers: Array.from(teachers).sort(),
        organizations: Array.from(organizations).sort(),
      });
    }

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

    if (area) {
      filteredShiurim = filteredShiurim.filter((s) => s.locationArea === area);
    }

    if (teacher) {
      filteredShiurim = filteredShiurim.filter((s) => s.teacherName === teacher);
    }

    if (organization) {
      filteredShiurim = filteredShiurim.filter((s) => s.projectOf === organization);
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

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to auto-approve shiurim
    const userId = parseInt(session.user.id);
    const [user] = await db
      .select({
        role: users.role,
        canAutoApproveShiurim: users.canAutoApproveShiurim,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const canSubmit = user?.role === "admin" || user?.canAutoApproveShiurim;

    if (!canSubmit) {
      return NextResponse.json(
        { error: "You don't have permission to submit shiurim. Please contact admin to request posting access." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      teacherTitle,
      teacherFirstName,
      teacherLastName,
      locationName,
      locationAddress,
      locationArea,
      shulId,
      schedule,
      category,
      level,
      gender,
      contactName,
      contactPhone,
      contactEmail,
      website,
      cost,
      projectOf,
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Build teacher name from components
    const teacherName = [teacherTitle, teacherFirstName, teacherLastName]
      .filter(Boolean)
      .join(" ")
      .trim() || "Unknown Teacher";

    const [newShiur] = await db
      .insert(shiurim)
      .values({
        title: title.trim(),
        description: description?.trim() || null,
        teacherTitle: teacherTitle?.trim() || null,
        teacherFirstName: teacherFirstName?.trim() || null,
        teacherLastName: teacherLastName?.trim() || null,
        teacherName,
        locationName: locationName?.trim() || null,
        locationAddress: locationAddress?.trim() || null,
        locationArea: locationArea?.trim() || null,
        shulId: shulId ? parseInt(shulId) : null,
        schedule: schedule || null,
        category: category || null,
        level: level || null,
        gender: gender || null,
        contactName: contactName?.trim() || null,
        contactPhone: contactPhone?.trim() || null,
        contactEmail: contactEmail?.trim() || null,
        website: website?.trim() || null,
        cost: cost?.trim() || null,
        projectOf: projectOf?.trim() || null,
        isActive: true,
        isOnHold: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json(newShiur, { status: 201 });
  } catch (error) {
    console.error("Error creating shiur:", error);
    return NextResponse.json(
      { error: "Failed to create shiur" },
      { status: 500 }
    );
  }
}
