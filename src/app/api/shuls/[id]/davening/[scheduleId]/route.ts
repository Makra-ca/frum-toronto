import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { daveningSchedules } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { canUserManageShul } from "@/lib/auth/permissions";

interface RouteParams {
  params: Promise<{ id: string; scheduleId: string }>;
}

// PUT update a davening schedule
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, scheduleId } = await params;
    const shulId = parseInt(id);
    const userId = parseInt(session.user.id);

    // Check permissions
    const canManage = await canUserManageShul(userId, shulId, session.user.role);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { tefilahType, dayOfWeek, time, notes, isWinter, isSummer, isShabbos } = body;

    await db
      .update(daveningSchedules)
      .set({
        tefilahType,
        dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : null,
        time,
        notes: notes || null,
        isWinter: isWinter ?? false,
        isSummer: isSummer ?? false,
        isShabbos: isShabbos ?? false,
      })
      .where(
        and(
          eq(daveningSchedules.id, parseInt(scheduleId)),
          eq(daveningSchedules.shulId, shulId)
        )
      );

    return NextResponse.json({ message: "Schedule updated successfully" });
  } catch (error) {
    console.error("Failed to update davening schedule:", error);
    return NextResponse.json(
      { error: "Failed to update schedule" },
      { status: 500 }
    );
  }
}

// DELETE a davening schedule
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, scheduleId } = await params;
    const shulId = parseInt(id);
    const userId = parseInt(session.user.id);

    // Check permissions
    const canManage = await canUserManageShul(userId, shulId, session.user.role);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db
      .delete(daveningSchedules)
      .where(
        and(
          eq(daveningSchedules.id, parseInt(scheduleId)),
          eq(daveningSchedules.shulId, shulId)
        )
      );

    return NextResponse.json({ message: "Schedule deleted successfully" });
  } catch (error) {
    console.error("Failed to delete davening schedule:", error);
    return NextResponse.json(
      { error: "Failed to delete schedule" },
      { status: 500 }
    );
  }
}
