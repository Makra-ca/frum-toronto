import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { userShuls, users, shuls } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";

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
          name: shuls.name,
        },
        shulName: shuls.name,
      })
      .from(userShuls)
      .leftJoin(users, eq(userShuls.userId, users.id))
      .leftJoin(shuls, eq(userShuls.shulId, shuls.id))
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

    // Promote a plain member to "shul" so the dashboard's "Manage My Shuls"
    // link appears. Only "member" — this used to be unconditional, which
    // demoted an admin picked from the (unfiltered) user list straight out of
    // /admin. Authority to manage the shul comes from the userShuls row above,
    // not from this role, so leaving any other role untouched is safe.
    await db
      .update(users)
      .set({ role: "shul", updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.role, "member")));

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
