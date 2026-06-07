import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businesses, businessShoutouts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notifyAdminOfSubmission } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// PATCH /api/businesses/[id]/shoutouts/[shoutoutId] - Update a draft or rejected shoutout
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; shoutoutId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, shoutoutId } = await params;
    const businessId = parseInt(id);
    const shoutoutIdNum = parseInt(shoutoutId);

    if (isNaN(businessId) || isNaN(shoutoutIdNum)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const userId = parseInt(session.user.id);
    const isAdmin = session.user.role === "admin";

    // Verify business ownership
    const [business] = await db
      .select({ id: businesses.id, userId: businesses.userId, name: businesses.name })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    if (!isAdmin && business.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch the shoutout
    const [shoutout] = await db
      .select()
      .from(businessShoutouts)
      .where(
        and(
          eq(businessShoutouts.id, shoutoutIdNum),
          eq(businessShoutouts.businessId, businessId)
        )
      )
      .limit(1);

    if (!shoutout) {
      return NextResponse.json({ error: "Shoutout not found" }, { status: 404 });
    }

    // Only allow editing draft or rejected shoutouts
    if (!isAdmin && shoutout.status !== "draft" && shoutout.status !== "rejected") {
      return NextResponse.json(
        { error: "Only draft or rejected shoutouts can be edited" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { scheduledDate, contentHtml, contentJson, imageUrl } = body;

    const updateFields: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (scheduledDate !== undefined) updateFields.scheduledDate = scheduledDate;
    if (contentHtml !== undefined) updateFields.contentHtml = contentHtml;
    if (contentJson !== undefined) updateFields.contentJson = contentJson;
    if (imageUrl !== undefined) updateFields.imageUrl = imageUrl;

    // If was rejected and being re-submitted, advance to pending_approval
    if (shoutout.status === "rejected") {
      updateFields.status = "pending_approval";
      updateFields.rejectionReason = null;
    }

    const [updated] = await db
      .update(businessShoutouts)
      .set(updateFields)
      .where(eq(businessShoutouts.id, shoutoutIdNum))
      .returning();

    // Notify admins on re-submit after rejection (in-app + instant email)
    if (shoutout.status === "rejected") {
      await notifyAdminOfSubmission({
        contentType: "shoutout",
        title: `Shoutout re-submitted after rejection — ${business.name}`,
        body:
          `Business: ${business.name}\n` +
          `Scheduled Date: ${updated.scheduledDate}\n` +
          `Re-submitted by: ${session.user.name || session.user.email || "Unknown user"}`,
        linkUrl: "/admin/businesses/shoutouts",
        status: "pending",
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[Shoutout PATCH] Error:", error);
    return NextResponse.json(
      { error: "Failed to update shoutout" },
      { status: 500 }
    );
  }
}
