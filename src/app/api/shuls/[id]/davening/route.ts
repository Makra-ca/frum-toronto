import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { daveningSchedules, shuls } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { canUserManageShul } from "@/lib/auth/permissions";
import { notifyAdminOfSubmission } from "@/lib/notifications";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Notification prep only — never let a name lookup fail the request
async function getShulName(shulId: number): Promise<string> {
  try {
    const [shul] = await db
      .select({ name: shuls.name })
      .from(shuls)
      .where(eq(shuls.id, shulId))
      .limit(1);
    return shul?.name || `Shul #${shulId}`;
  } catch {
    return `Shul #${shulId}`;
  }
}

// GET davening schedules for a shul
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const shulId = parseInt(id);
    const userId = parseInt(session.user.id);

    // Check permissions
    const canManage = await canUserManageShul(userId, shulId, session.user.role);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const schedules = await db
      .select()
      .from(daveningSchedules)
      .where(eq(daveningSchedules.shulId, shulId));

    return NextResponse.json(schedules);
  } catch (error) {
    console.error("Failed to fetch davening schedules:", error);
    return NextResponse.json(
      { error: "Failed to fetch schedules" },
      { status: 500 }
    );
  }
}

// POST create new davening schedule
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const shulId = parseInt(id);
    const userId = parseInt(session.user.id);

    // Check permissions
    const canManage = await canUserManageShul(userId, shulId, session.user.role);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { tefilahType, dayOfWeek, time, notes, isWinter, isSummer, isShabbos } = body;

    const [schedule] = await db
      .insert(daveningSchedules)
      .values({
        shulId,
        tefilahType,
        dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : null,
        time,
        notes: notes || null,
        isWinter: isWinter ?? false,
        isSummer: isSummer ?? false,
        isShabbos: isShabbos ?? false,
      })
      .returning();

    // Notify admins (Tier C FYI — davening edits go live without review)
    const shulName = await getShulName(shulId);
    await notifyAdminOfSubmission({
      contentType: "davening_edit",
      title: `Davening schedule added: ${shulName}`,
      body:
        `Shul: ${shulName}\n` +
        `Tefilah: ${tefilahType || "Unknown"} at ${time || "?"}\n` +
        `Added by: ${session.user.name || session.user.email || "Unknown user"}`,
      linkUrl: `/admin/shuls/${shulId}/davening`,
      status: "auto_approved",
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    console.error("Failed to create davening schedule:", error);
    return NextResponse.json(
      { error: "Failed to create schedule" },
      { status: 500 }
    );
  }
}
