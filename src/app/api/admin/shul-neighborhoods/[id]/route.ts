import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shulNeighborhoods } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  displayOrder: z.number().int().optional(),
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
    const nid = parseInt(id);
    if (isNaN(nid)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const body = await request.json();
    const result = updateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (result.data.name !== undefined) updates.name = result.data.name;
    if (result.data.displayOrder !== undefined) updates.displayOrder = result.data.displayOrder;
    if (result.data.isActive !== undefined) updates.isActive = result.data.isActive;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const [updated] = await db
      .update(shulNeighborhoods)
      .set(updates)
      .where(eq(shulNeighborhoods.id, nid))
      .returning();

    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[ADMIN] Error updating neighborhood:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
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
    const nid = parseInt(id);
    if (isNaN(nid)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const [deleted] = await db
      .delete(shulNeighborhoods)
      .where(eq(shulNeighborhoods.id, nid))
      .returning();

    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Note: shuls.neighborhood stores the name string, so existing shuls keep
    // their label even if the list entry is removed; they just won't match the
    // (now-absent) filter option until re-tagged.
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADMIN] Error deleting neighborhood:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
