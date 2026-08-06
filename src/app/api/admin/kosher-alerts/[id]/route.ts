import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { kosherAlerts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { sendKosherAlertBroadcast } from "@/lib/email/send";
import { setApprovalStatus } from "@/lib/submissions/set-approval-status";
import { APPROVAL_STATUSES } from "@/lib/submissions/statuses";

const updateSchema = z.object({
  productName: z.string().min(1).max(200).optional(),
  brand: z.string().max(200).optional().nullable(),
  alertType: z.string().optional().nullable(),
  description: z.string().min(1).optional(),
  certifyingAgency: z.string().max(200).optional().nullable(),
  effectiveDate: z.string().optional().nullable(),
  issueDate: z.string().optional().nullable(),
  approvalStatus: z.enum(APPROVAL_STATUSES).optional(),
  rejectionReason: z.string().max(2000).optional().nullable(),
  isActive: z.boolean().optional(),
});

// GET - Get single kosher alert
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
      .from(kosherAlerts)
      .where(eq(kosherAlerts.id, alertId))
      .limit(1);

    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    return NextResponse.json(alert);
  } catch (error) {
    console.error("[API] Error fetching kosher alert:", error);
    return NextResponse.json({ error: "Failed to fetch alert" }, { status: 500 });
  }
}

// PATCH - Update kosher alert
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
    const { sendNotification, ...updateData } = body;

    const result = updateSchema.safeParse(updateData);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const [currentAlert] = await db
      .select()
      .from(kosherAlerts)
      .where(eq(kosherAlerts.id, alertId))
      .limit(1);

    if (!currentAlert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    // The status is written by setApprovalStatus and nowhere else, so the
    // broadcast decision and the submitter notification cannot be forgotten
    // here. Content fields are written first, so the notification quotes the
    // corrected text rather than the old.
    const { approvalStatus, rejectionReason, ...contentFields } = result.data;

    let [updated] = Object.keys(contentFields).length
      ? await db
          .update(kosherAlerts)
          .set(contentFields)
          .where(eq(kosherAlerts.id, alertId))
          .returning()
      : [currentAlert];

    let alreadyBroadcast = false;
    if (approvalStatus && approvalStatus !== currentAlert.approvalStatus) {
      const outcome = await setApprovalStatus({
        type: "kosherAlert",
        id: alertId,
        next: approvalStatus,
        rejectionReason,
      });
      alreadyBroadcast = outcome.broadcast;
      [updated] = await db
        .select()
        .from(kosherAlerts)
        .where(eq(kosherAlerts.id, alertId))
        .limit(1);
    }

    // The admin's explicit "Save & Notify" — a deliberate re-send, separate
    // from the once-only approval broadcast. Suppressed when the approval in
    // this same request already announced it: the old code combined the two
    // into one boolean, so approving with the box ticked sent once, and
    // splitting them without this guard would send twice.
    if (sendNotification && !alreadyBroadcast) {
      const notificationsSent = await sendKosherAlertBroadcast(updated);
      // Stamped even though this is a deliberate re-send, because the stamp
      // answers "has this row ever been announced", not "how many times".
      // Without it: create silently (sendNotification false, stamp NULL by
      // design) → Save & Notify (emailed, still NULL) → reject to fix a typo →
      // approve → setApprovalStatus sees previous "rejected" and a NULL stamp,
      // every guard passes, and the recall goes out a second time. The
      // alreadyBroadcast flag above only covers the same request.
      await db
        .update(kosherAlerts)
        .set({ broadcastAt: new Date() })
        .where(eq(kosherAlerts.id, alertId));
      return NextResponse.json({ alert: updated, notificationsSent });
    }

    return NextResponse.json({ alert: updated });
  } catch (error) {
    console.error("[API] Error updating kosher alert:", error);
    return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
  }
}

// DELETE - Delete kosher alert
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
      .delete(kosherAlerts)
      .where(eq(kosherAlerts.id, alertId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error deleting kosher alert:", error);
    return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 });
  }
}
