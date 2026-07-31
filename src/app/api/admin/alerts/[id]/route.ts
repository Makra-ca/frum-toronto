import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { alerts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { APPROVAL_STATUSES } from "@/lib/submissions/statuses";
import { setApprovalStatus } from "@/lib/submissions/set-approval-status";

const updateSchema = z.object({
  alertType: z.string().min(1).optional(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  urgency: z.string().optional(),
  isPinned: z.boolean().optional(),
  expiresAt: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  // Absent until now, so a submitted alert could never be approved through any
  // admin surface — and the public page only shows approved ones.
  approvalStatus: z.enum(APPROVAL_STATUSES).optional(),
  rejectionReason: z.string().max(2000).optional().nullable(),
});

// GET - Get single alert
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
    const alertId = parseInt(id);

    const [alert] = await db
      .select()
      .from(alerts)
      .where(eq(alerts.id, alertId))
      .limit(1);

    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    return NextResponse.json(alert);
  } catch (error) {
    console.error("[API] Error fetching alert:", error);
    return NextResponse.json({ error: "Failed to fetch alert" }, { status: 500 });
  }
}

// PATCH - Update alert
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
    const alertId = parseInt(id);
    const body = await request.json();

    const result = updateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    // approvalStatus is stripped out — setApprovalStatus owns every transition
    // so the submitter notification cannot be forgotten here.
    const { approvalStatus, rejectionReason, ...contentFields } = result.data;

    const updateData: Record<string, unknown> = { ...contentFields };
    if (result.data.expiresAt !== undefined) {
      updateData.expiresAt = result.data.expiresAt ? new Date(result.data.expiresAt) : null;
    }

    const [prior] = await db
      .select()
      .from(alerts)
      .where(eq(alerts.id, alertId))
      .limit(1);

    if (!prior) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    let [updated] = Object.keys(updateData).length
      ? await db
          .update(alerts)
          .set(updateData)
          .where(eq(alerts.id, alertId))
          .returning()
      : [prior];

    if (approvalStatus !== undefined && approvalStatus !== prior.approvalStatus) {
      await setApprovalStatus({
        type: "alert",
        id: alertId,
        next: approvalStatus,
        rejectionReason,
      });
      [updated] = await db
        .select()
        .from(alerts)
        .where(eq(alerts.id, alertId))
        .limit(1);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[API] Error updating alert:", error);
    return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
  }
}

// DELETE - Delete alert
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
    const alertId = parseInt(id);

    const [deleted] = await db
      .delete(alerts)
      .where(eq(alerts.id, alertId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error deleting alert:", error);
    return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 });
  }
}
