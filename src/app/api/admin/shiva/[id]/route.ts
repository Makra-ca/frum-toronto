import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shivaNotifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  niftarName: z.string().max(200).optional(),
  niftarNameHebrew: z.string().max(200).optional().nullable(),
  mournerNames: z.array(z.string()).optional(),
  shivaAddress: z.string().max(500).optional().nullable(),
  shivaStart: z.string().optional(),
  shivaEnd: z.string().optional(),
  shivaHours: z.string().max(200).optional().nullable(),
  mealInfo: z.string().optional().nullable(),
  donationInfo: z.string().optional().nullable(),
  contactPhone: z.string().max(40).optional().nullable(),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
});

// GET - Get single shiva notice
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const shivaId = parseInt(id);

    if (isNaN(shivaId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const [entry] = await db
      .select()
      .from(shivaNotifications)
      .where(eq(shivaNotifications.id, shivaId))
      .limit(1);

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json(entry);
  } catch (error) {
    console.error("[API] Error fetching shiva notice:", error);
    return NextResponse.json({ error: "Failed to fetch entry" }, { status: 500 });
  }
}

// PATCH - Update shiva notice
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const shivaId = parseInt(id);

    if (isNaN(shivaId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const result = updateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if (result.data.niftarName !== undefined) {
      updates.niftarName = result.data.niftarName?.trim() || null;
    }
    if (result.data.niftarNameHebrew !== undefined) {
      updates.niftarNameHebrew = result.data.niftarNameHebrew?.trim() || null;
    }
    if (result.data.mournerNames !== undefined) {
      updates.mournerNames = result.data.mournerNames.filter((n) => n.trim());
    }
    if (result.data.shivaAddress !== undefined) {
      updates.shivaAddress = result.data.shivaAddress?.trim() || null;
    }
    if (result.data.shivaStart !== undefined) {
      updates.shivaStart = result.data.shivaStart;
    }
    if (result.data.shivaEnd !== undefined) {
      updates.shivaEnd = result.data.shivaEnd;
    }
    if (result.data.shivaHours !== undefined) {
      updates.shivaHours = result.data.shivaHours?.trim() || null;
    }
    if (result.data.mealInfo !== undefined) {
      updates.mealInfo = result.data.mealInfo?.trim() || null;
    }
    if (result.data.donationInfo !== undefined) {
      updates.donationInfo = result.data.donationInfo?.trim() || null;
    }
    if (result.data.contactPhone !== undefined) {
      updates.contactPhone = result.data.contactPhone?.trim() || null;
    }
    if (result.data.approvalStatus !== undefined) {
      updates.approvalStatus = result.data.approvalStatus;
    }

    const [updated] = await db
      .update(shivaNotifications)
      .set(updates)
      .where(eq(shivaNotifications.id, shivaId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[API] Error updating shiva notice:", error);
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}

// DELETE - Admin delete shiva notice
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const shivaId = parseInt(id);

    if (isNaN(shivaId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(shivaNotifications)
      .where(eq(shivaNotifications.id, shivaId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error("[API] Error deleting shiva notice:", error);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}
