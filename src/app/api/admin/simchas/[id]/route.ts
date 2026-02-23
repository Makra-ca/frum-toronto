import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { simchas } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  familyName: z.string().max(200).optional(),
  announcement: z.string().optional(),
  eventDate: z.string().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  photoUrl: z.string().max(500).optional().nullable(),
  typeId: z.number().optional().nullable(),
  isActive: z.boolean().optional(),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
});

// GET - Get single simcha entry
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
    const simchaId = parseInt(id);

    if (isNaN(simchaId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const [entry] = await db
      .select()
      .from(simchas)
      .where(eq(simchas.id, simchaId))
      .limit(1);

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json(entry);
  } catch (error) {
    console.error("[API] Error fetching simcha:", error);
    return NextResponse.json({ error: "Failed to fetch entry" }, { status: 500 });
  }
}

// PATCH - Update simcha entry
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
    const simchaId = parseInt(id);

    if (isNaN(simchaId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const result = updateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if (result.data.familyName !== undefined) {
      updates.familyName = result.data.familyName?.trim() || "";
    }
    if (result.data.announcement !== undefined) {
      updates.announcement = result.data.announcement?.trim() || "";
    }
    if (result.data.eventDate !== undefined) {
      updates.eventDate = result.data.eventDate || null;
    }
    if (result.data.location !== undefined) {
      updates.location = result.data.location?.trim() || null;
    }
    if (result.data.photoUrl !== undefined) {
      updates.photoUrl = result.data.photoUrl?.trim() || null;
    }
    if (result.data.typeId !== undefined) {
      updates.typeId = result.data.typeId;
    }
    if (result.data.isActive !== undefined) {
      updates.isActive = result.data.isActive;
    }
    if (result.data.approvalStatus !== undefined) {
      updates.approvalStatus = result.data.approvalStatus;
    }

    const [updated] = await db
      .update(simchas)
      .set(updates)
      .where(eq(simchas.id, simchaId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[API] Error updating simcha:", error);
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}

// DELETE - Admin delete simcha entry
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
    const simchaId = parseInt(id);

    if (isNaN(simchaId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(simchas)
      .where(eq(simchas.id, simchaId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error("[API] Error deleting simcha:", error);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}
