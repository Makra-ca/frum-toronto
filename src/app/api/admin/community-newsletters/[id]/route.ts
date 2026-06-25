import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { communityNewsletters } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  publisher: z.string().trim().max(200).optional().nullable(),
  fileUrl: z.string().url().optional(),
  fileSize: z.number().int().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
});

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
    const newsletterId = parseInt(id);
    if (isNaN(newsletterId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const result = updateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (result.data.title !== undefined) updates.title = result.data.title;
    if (result.data.publisher !== undefined) updates.publisher = result.data.publisher?.trim() || null;
    if (result.data.fileUrl !== undefined) updates.fileUrl = result.data.fileUrl;
    if (result.data.fileSize !== undefined) updates.fileSize = result.data.fileSize;
    if (result.data.description !== undefined) updates.description = result.data.description?.trim() || null;
    if (result.data.isActive !== undefined) updates.isActive = result.data.isActive;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const [updated] = await db
      .update(communityNewsletters)
      .set(updates)
      .where(eq(communityNewsletters.id, newsletterId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Newsletter not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[ADMIN] Error updating community newsletter:", error);
    return NextResponse.json({ error: "Failed to update newsletter" }, { status: 500 });
  }
}

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
    const newsletterId = parseInt(id);
    if (isNaN(newsletterId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(communityNewsletters)
      .where(eq(communityNewsletters.id, newsletterId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Newsletter not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADMIN] Error deleting community newsletter:", error);
    return NextResponse.json({ error: "Failed to delete newsletter" }, { status: 500 });
  }
}
