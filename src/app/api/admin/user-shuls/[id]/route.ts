import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { userShuls, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE - remove a user-shul assignment
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const assignmentId = parseInt(id);

    // Get the assignment to find the userId
    const [assignment] = await db
      .select()
      .from(userShuls)
      .where(eq(userShuls.id, assignmentId))
      .limit(1);

    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    // Delete the assignment
    await db.delete(userShuls).where(eq(userShuls.id, assignmentId));

    // Check if user has any other shul assignments
    const remainingAssignments = await db
      .select()
      .from(userShuls)
      .where(eq(userShuls.userId, assignment.userId))
      .limit(1);

    // If no more shul assignments, downgrade user role to member
    if (remainingAssignments.length === 0) {
      // Get current user to check role
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, assignment.userId))
        .limit(1);

      if (user && user.role === "shul") {
        await db
          .update(users)
          .set({ role: "member", updatedAt: new Date() })
          .where(eq(users.id, assignment.userId));
      }
    }

    return NextResponse.json({ message: "Assignment removed successfully" });
  } catch (error) {
    console.error("Failed to remove user-shul assignment:", error);
    return NextResponse.json(
      { error: "Failed to remove assignment" },
      { status: 500 }
    );
  }
}
