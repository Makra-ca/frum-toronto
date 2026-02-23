import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      role,
      isTrusted,
      isActive,
      emailVerified,
      canAutoApproveShiva,
      canAutoApproveTehillim,
      canAutoApproveBusinesses,
      canAutoApproveAskTheRabbi,
      canAutoApproveKosherAlerts,
      canAutoApproveShuls,
      canAutoApproveSimchas,
      canAutoApproveEvents,
      canAutoApproveClassifieds,
      canAutoApproveShiurim,
      canPostSpecials,
    } = body;

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (role !== undefined) updateData.role = role;
    if (isTrusted !== undefined) updateData.isTrusted = isTrusted;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (emailVerified !== undefined) {
      updateData.emailVerified = emailVerified ? new Date() : null;
    }
    // Auto-approve permissions
    if (canAutoApproveShiva !== undefined) updateData.canAutoApproveShiva = canAutoApproveShiva;
    if (canAutoApproveTehillim !== undefined) updateData.canAutoApproveTehillim = canAutoApproveTehillim;
    if (canAutoApproveBusinesses !== undefined) updateData.canAutoApproveBusinesses = canAutoApproveBusinesses;
    if (canAutoApproveAskTheRabbi !== undefined) updateData.canAutoApproveAskTheRabbi = canAutoApproveAskTheRabbi;
    if (canAutoApproveKosherAlerts !== undefined) updateData.canAutoApproveKosherAlerts = canAutoApproveKosherAlerts;
    if (canAutoApproveShuls !== undefined) updateData.canAutoApproveShuls = canAutoApproveShuls;
    if (canAutoApproveSimchas !== undefined) updateData.canAutoApproveSimchas = canAutoApproveSimchas;
    if (canAutoApproveEvents !== undefined) updateData.canAutoApproveEvents = canAutoApproveEvents;
    if (canAutoApproveClassifieds !== undefined) updateData.canAutoApproveClassifieds = canAutoApproveClassifieds;
    if (canAutoApproveShiurim !== undefined) updateData.canAutoApproveShiurim = canAutoApproveShiurim;
    if (canPostSpecials !== undefined) updateData.canPostSpecials = canPostSpecials;

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, parseInt(id)));

    return NextResponse.json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}
