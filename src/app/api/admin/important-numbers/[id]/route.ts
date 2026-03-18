import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { importantNumbers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// PATCH - Update an important number
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
    const numberId = parseInt(id);
    const body = await request.json();

    const updateData: Record<string, unknown> = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }
      updateData.name = name;
    }

    if (typeof body.phone === "string") {
      const phone = body.phone.trim();
      if (!phone) {
        return NextResponse.json({ error: "Phone is required" }, { status: 400 });
      }
      updateData.phone = phone;
    }

    if (body.category !== undefined) {
      updateData.category = typeof body.category === "string" ? body.category.trim() || null : null;
    }

    if (body.description !== undefined) {
      updateData.description = typeof body.description === "string" ? body.description.trim() || null : null;
    }

    if (typeof body.isEmergency === "boolean") {
      updateData.isEmergency = body.isEmergency;
    }

    if (typeof body.displayOrder === "number") {
      updateData.displayOrder = body.displayOrder;
    }

    const [updated] = await db
      .update(importantNumbers)
      .set(updateData)
      .where(eq(importantNumbers.id, numberId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Important number not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[API] Error updating important number:", error);
    return NextResponse.json({ error: "Failed to update important number" }, { status: 500 });
  }
}

// DELETE - Delete an important number
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
    const numberId = parseInt(id);

    const [deleted] = await db
      .delete(importantNumbers)
      .where(eq(importantNumbers.id, numberId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Important number not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error deleting important number:", error);
    return NextResponse.json({ error: "Failed to delete important number" }, { status: 500 });
  }
}
