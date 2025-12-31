import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { daveningSchedules } from "@/lib/db/schema";
import { daveningScheduleSchema } from "@/lib/validations/content";
import { eq, and } from "drizzle-orm";

// PUT /api/admin/shuls/[id]/davening/[scheduleId] - Update davening schedule
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; scheduleId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, scheduleId } = await params;
    const shulId = parseInt(id);
    const scheduleIdNum = parseInt(scheduleId);

    if (isNaN(shulId) || isNaN(scheduleIdNum)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Check if schedule exists and belongs to this shul
    const [existingSchedule] = await db
      .select()
      .from(daveningSchedules)
      .where(
        and(
          eq(daveningSchedules.id, scheduleIdNum),
          eq(daveningSchedules.shulId, shulId)
        )
      )
      .limit(1);

    if (!existingSchedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = daveningScheduleSchema.parse({
      ...body,
      shulId,
    });

    const [updatedSchedule] = await db
      .update(daveningSchedules)
      .set({
        tefilahType: validatedData.tefilahType,
        dayOfWeek: validatedData.dayOfWeek,
        time: validatedData.time,
        notes: validatedData.notes,
        isWinter: validatedData.isWinter,
        isSummer: validatedData.isSummer,
        isShabbos: validatedData.isShabbos,
      })
      .where(eq(daveningSchedules.id, scheduleIdNum))
      .returning();

    return NextResponse.json(updatedSchedule);
  } catch (error) {
    console.error("Error updating davening schedule:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid data", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update davening schedule" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/shuls/[id]/davening/[scheduleId] - Delete davening schedule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; scheduleId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, scheduleId } = await params;
    const shulId = parseInt(id);
    const scheduleIdNum = parseInt(scheduleId);

    if (isNaN(shulId) || isNaN(scheduleIdNum)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Check if schedule exists and belongs to this shul
    const [existingSchedule] = await db
      .select()
      .from(daveningSchedules)
      .where(
        and(
          eq(daveningSchedules.id, scheduleIdNum),
          eq(daveningSchedules.shulId, shulId)
        )
      )
      .limit(1);

    if (!existingSchedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    await db
      .delete(daveningSchedules)
      .where(eq(daveningSchedules.id, scheduleIdNum));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting davening schedule:", error);
    return NextResponse.json(
      { error: "Failed to delete davening schedule" },
      { status: 500 }
    );
  }
}
