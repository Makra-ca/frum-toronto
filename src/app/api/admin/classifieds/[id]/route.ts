import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { classifieds } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { setApprovalStatus } from "@/lib/submissions/set-approval-status";
import { APPROVAL_STATUSES } from "@/lib/submissions/statuses";

const updateSchema = z.object({
  title: z.string().max(255).optional(),
  description: z.string().max(2000, "Description must be 2,000 characters or less").optional(),
  price: z.string().optional().nullable(),
  priceType: z.enum(["fixed", "negotiable", "free"]).optional().nullable(),
  contactName: z.string().max(100).optional().nullable(),
  contactEmail: z.string().max(255).optional().nullable(),
  contactPhone: z.string().max(40).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  categoryId: z.number().optional().nullable(),
  isSpecial: z.boolean().optional(),
  isActive: z.boolean().optional(),
  approvalStatus: z.enum(APPROVAL_STATUSES).optional(),
  rejectionReason: z.string().max(2000).optional().nullable(),
});

// GET - Get single classified entry
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
    const classifiedId = parseInt(id);

    if (isNaN(classifiedId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const [entry] = await db
      .select()
      .from(classifieds)
      .where(eq(classifieds.id, classifiedId))
      .limit(1);

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json(entry);
  } catch (error) {
    console.error("[API] Error fetching classified:", error);
    return NextResponse.json({ error: "Failed to fetch entry" }, { status: 500 });
  }
}

// PATCH - Update classified entry
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
    const classifiedId = parseInt(id);

    if (isNaN(classifiedId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const result = updateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if (result.data.title !== undefined) {
      updates.title = result.data.title?.trim() || "";
    }
    if (result.data.description !== undefined) {
      updates.description = result.data.description?.trim() || "";
    }
    if (result.data.price !== undefined) {
      updates.price = result.data.price || null;
    }
    if (result.data.priceType !== undefined) {
      updates.priceType = result.data.priceType;
    }
    if (result.data.contactName !== undefined) {
      updates.contactName = result.data.contactName?.trim() || null;
    }
    if (result.data.contactEmail !== undefined) {
      updates.contactEmail = result.data.contactEmail?.trim() || null;
    }
    if (result.data.contactPhone !== undefined) {
      updates.contactPhone = result.data.contactPhone?.trim() || null;
    }
    if (result.data.location !== undefined) {
      updates.location = result.data.location?.trim() || null;
    }
    if (result.data.imageUrl !== undefined) {
      updates.imageUrl = result.data.imageUrl?.trim() || null;
    }
    if (result.data.categoryId !== undefined) {
      updates.categoryId = result.data.categoryId;
    }
    if (result.data.isSpecial !== undefined) {
      updates.isSpecial = result.data.isSpecial;
    }
    if (result.data.isActive !== undefined) {
      updates.isActive = result.data.isActive;
    }
    // approvalStatus is NOT written here. setApprovalStatus owns every
    // transition, so the submitter notification cannot be forgotten on this
    // route while working on the next one.

    const [prior] = await db
      .select()
      .from(classifieds)
      .where(eq(classifieds.id, classifiedId))
      .limit(1);

    if (!prior) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    // Content first, so a notification quotes the corrected text.
    let [updated] = Object.keys(updates).length
      ? await db
          .update(classifieds)
          .set(updates)
          .where(eq(classifieds.id, classifiedId))
          .returning()
      : [prior];

    if (
      result.data.approvalStatus !== undefined &&
      result.data.approvalStatus !== prior.approvalStatus
    ) {
      await setApprovalStatus({
        type: "classified",
        id: classifiedId,
        next: result.data.approvalStatus,
        rejectionReason: result.data.rejectionReason,
      });
      [updated] = await db
        .select()
        .from(classifieds)
        .where(eq(classifieds.id, classifiedId))
        .limit(1);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[API] Error updating classified:", error);
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}

// DELETE - Admin delete classified entry
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
    const classifiedId = parseInt(id);

    if (isNaN(classifiedId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(classifieds)
      .where(eq(classifieds.id, classifiedId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error("[API] Error deleting classified:", error);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}
