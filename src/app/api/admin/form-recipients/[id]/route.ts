import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { formEmailRecipients } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  email: z.string().email("Valid email is required").optional(),
  name: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// PATCH - Update a recipient
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
    const recipientId = parseInt(id);

    if (isNaN(recipientId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const result = updateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (result.data.email !== undefined) updates.email = result.data.email.toLowerCase();
    if (result.data.name !== undefined) updates.name = result.data.name;
    if (result.data.isActive !== undefined) updates.isActive = result.data.isActive;

    const [updated] = await db
      .update(formEmailRecipients)
      .set(updates)
      .where(eq(formEmailRecipients.id, recipientId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[API] Error updating form recipient:", error);
    return NextResponse.json({ error: "Failed to update recipient" }, { status: 500 });
  }
}

// DELETE - Remove a recipient
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
    const recipientId = parseInt(id);

    if (isNaN(recipientId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(formEmailRecipients)
      .where(eq(formEmailRecipients.id, recipientId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error deleting form recipient:", error);
    return NextResponse.json({ error: "Failed to delete recipient" }, { status: 500 });
  }
}
