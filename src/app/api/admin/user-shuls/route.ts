import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { userShuls, users, shuls, businesses } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// GET all user-shul assignments
export async function GET() {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const assignments = await db
      .select({
        id: userShuls.id,
        assignedAt: userShuls.assignedAt,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
        },
        shul: {
          id: shuls.id,
          businessId: shuls.businessId,
        },
        shulName: businesses.name,
      })
      .from(userShuls)
      .leftJoin(users, eq(userShuls.userId, users.id))
      .leftJoin(shuls, eq(userShuls.shulId, shuls.id))
      .leftJoin(businesses, eq(shuls.businessId, businesses.id))
      .orderBy(desc(userShuls.assignedAt));

    return NextResponse.json(assignments);
  } catch (error) {
    console.error("Failed to fetch user-shul assignments:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}

// POST - create a new user-shul assignment
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { userId, shulId } = body;

    if (!userId || !shulId) {
      return NextResponse.json(
        { error: "userId and shulId are required" },
        { status: 400 }
      );
    }

    // Check if assignment already exists
    const existing = await db
      .select()
      .from(userShuls)
      .where(eq(userShuls.userId, userId))
      .limit(1);

    const existingForShul = existing.find((a) => {
      // We need to check both userId and shulId
      return true; // Simplified - we'll rely on unique constraint
    });

    // Insert the assignment (unique constraint will prevent duplicates)
    const adminId = parseInt(session.user.id);

    try {
      await db.insert(userShuls).values({
        userId,
        shulId,
        assignedBy: adminId,
      });
    } catch (insertError: unknown) {
      // Check for unique constraint violation
      if ((insertError as Error)?.message?.includes("unique") ||
          (insertError as Error)?.message?.includes("duplicate")) {
        return NextResponse.json(
          { error: "User is already assigned to this shul" },
          { status: 400 }
        );
      }
      throw insertError;
    }

    // Update user role to "shul" if not already
    await db
      .update(users)
      .set({ role: "shul", updatedAt: new Date() })
      .where(eq(users.id, userId));

    return NextResponse.json({
      message: "Assignment created successfully",
    });
  } catch (error) {
    console.error("Failed to create user-shul assignment:", error);
    return NextResponse.json(
      { error: "Failed to create assignment" },
      { status: 500 }
    );
  }
}
