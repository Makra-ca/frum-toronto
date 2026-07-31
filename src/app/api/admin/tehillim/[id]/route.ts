import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { tehillimList } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { setApprovalStatus } from "@/lib/submissions/set-approval-status";
import { APPROVAL_STATUSES } from "@/lib/submissions/statuses";

const updateSchema = z.object({
  hebrewName: z.string().max(200).optional(),
  englishName: z.string().max(200).optional(),
  motherHebrewName: z.string().max(200).optional(),
  reason: z.string().max(200).optional(),
  expiresAt: z.string().optional().nullable(),
  isPermanent: z.boolean().optional(),
  isActive: z.boolean().optional(),
  approvalStatus: z.enum(APPROVAL_STATUSES).optional(),
  rejectionReason: z.string().max(2000).optional().nullable(),
});

// GET - Get single tehillim entry
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
    const tehillimId = parseInt(id);

    if (isNaN(tehillimId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const [entry] = await db
      .select()
      .from(tehillimList)
      .where(eq(tehillimList.id, tehillimId))
      .limit(1);

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json(entry);
  } catch (error) {
    console.error("[API] Error fetching tehillim:", error);
    return NextResponse.json({ error: "Failed to fetch entry" }, { status: 500 });
  }
}

// PATCH - Update tehillim entry
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
    const tehillimId = parseInt(id);

    if (isNaN(tehillimId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const result = updateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if (result.data.hebrewName !== undefined) {
      updates.hebrewName = result.data.hebrewName?.trim() || null;
    }
    if (result.data.englishName !== undefined) {
      updates.englishName = result.data.englishName?.trim() || null;
    }
    if (result.data.motherHebrewName !== undefined) {
      updates.motherHebrewName = result.data.motherHebrewName?.trim() || null;
    }
    if (result.data.reason !== undefined) {
      updates.reason = result.data.reason?.trim() || null;
    }
    if (result.data.expiresAt !== undefined) {
      updates.expiresAt = result.data.expiresAt || null;
    }
    if (result.data.isPermanent !== undefined) {
      updates.isPermanent = result.data.isPermanent;
      // If making permanent, clear expiration
      if (result.data.isPermanent) {
        updates.expiresAt = null;
      }
    }
    if (result.data.isActive !== undefined) {
      updates.isActive = result.data.isActive;
    }
    // approvalStatus is NOT written here. setApprovalStatus owns every
    // transition, so the submitter notification cannot be forgotten on this
    // route while working on the next one.

    const [prior] = await db
      .select()
      .from(tehillimList)
      .where(eq(tehillimList.id, tehillimId))
      .limit(1);

    if (!prior) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    // Content first, so a notification quotes the corrected text.
    let [updated] = Object.keys(updates).length
      ? await db
          .update(tehillimList)
          .set(updates)
          .where(eq(tehillimList.id, tehillimId))
          .returning()
      : [prior];

    if (
      result.data.approvalStatus !== undefined &&
      result.data.approvalStatus !== prior.approvalStatus
    ) {
      await setApprovalStatus({
        type: "tehillim",
        id: tehillimId,
        next: result.data.approvalStatus,
        rejectionReason: result.data.rejectionReason,
      });
      [updated] = await db
        .select()
        .from(tehillimList)
        .where(eq(tehillimList.id, tehillimId))
        .limit(1);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[API] Error updating tehillim:", error);
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}

// DELETE - Admin delete tehillim entry
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
    const tehillimId = parseInt(id);

    if (isNaN(tehillimId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(tehillimList)
      .where(eq(tehillimList.id, tehillimId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error("[API] Error deleting tehillim:", error);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}
