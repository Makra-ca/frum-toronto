import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { daveningSchedules, shuls } from "@/lib/db/schema";
import { daveningScheduleSchema } from "@/lib/validations/content";
import { eq } from "drizzle-orm";

// GET /api/admin/shuls/[id]/davening - Get all davening schedules for a shul
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

    const schedules = await db
      .select()
      .from(daveningSchedules)
      .where(eq(daveningSchedules.shulId, shulId))
      .orderBy(daveningSchedules.dayOfWeek, daveningSchedules.time);

    return NextResponse.json(schedules);
  } catch (error) {
    console.error("Error fetching davening schedules:", error);
    return NextResponse.json(
      { error: "Failed to fetch davening schedules" },
      { status: 500 }
    );
  }
}

// POST /api/admin/shuls/[id]/davening - Create a new davening schedule
export async function POST(
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
    const [shul] = await db
      .select()
      .from(shuls)
      .where(eq(shuls.id, shulId))
      .limit(1);

    if (!shul) {
      return NextResponse.json({ error: "Shul not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = daveningScheduleSchema.parse({
      ...body,
      shulId,
    });

    const [newSchedule] = await db
      .insert(daveningSchedules)
      .values({
        shulId: validatedData.shulId,
        tefilahType: validatedData.tefilahType,
        dayOfWeek: validatedData.dayOfWeek,
        time: validatedData.time,
        notes: validatedData.notes,
        isWinter: validatedData.isWinter,
        isSummer: validatedData.isSummer,
        isShabbos: validatedData.isShabbos,
      })
      .returning();

    return NextResponse.json(newSchedule, { status: 201 });
  } catch (error) {
    console.error("Error creating davening schedule:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid data", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create davening schedule" },
      { status: 500 }
    );
  }
}
