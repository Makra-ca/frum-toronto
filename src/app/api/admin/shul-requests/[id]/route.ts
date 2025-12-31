import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shulRegistrationRequests, userShuls, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT - approve or reject a shul registration request
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, reviewNotes } = body; // action: 'approve' | 'reject'

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    const requestId = parseInt(id);

    // Get the request details
    const [existingRequest] = await db
      .select()
      .from(shulRegistrationRequests)
      .where(eq(shulRegistrationRequests.id, requestId))
      .limit(1);

    if (!existingRequest) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    if (existingRequest.status !== "pending") {
      return NextResponse.json(
        { error: "Request has already been processed" },
        { status: 400 }
      );
    }

    const adminId = parseInt(session.user.id);

    // Update the request status
    await db
      .update(shulRegistrationRequests)
      .set({
        status: action === "approve" ? "approved" : "rejected",
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
      })
      .where(eq(shulRegistrationRequests.id, requestId));

    // If approved, create the user-shul assignment and update user role
    if (action === "approve") {
      // Create user-shul assignment
      await db.insert(userShuls).values({
        userId: existingRequest.userId,
        shulId: existingRequest.shulId,
        assignedBy: adminId,
      });

      // Update user role to "shul" if not already
      await db
        .update(users)
        .set({ role: "shul", updatedAt: new Date() })
        .where(eq(users.id, existingRequest.userId));
    }

    return NextResponse.json({
      message: `Request ${action}d successfully`,
    });
  } catch (error) {
    console.error("Failed to process shul request:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

// DELETE - delete a request
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const requestId = parseInt(id);

    await db
      .delete(shulRegistrationRequests)
      .where(eq(shulRegistrationRequests.id, requestId));

    return NextResponse.json({ message: "Request deleted successfully" });
  } catch (error) {
    console.error("Failed to delete shul request:", error);
    return NextResponse.json(
      { error: "Failed to delete request" },
      { status: 500 }
    );
  }
}
