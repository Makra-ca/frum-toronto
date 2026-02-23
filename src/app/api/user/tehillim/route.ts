import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { tehillimList } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

// GET - Fetch user's own tehillim submissions
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be logged in" },
        { status: 401 }
      );
    }

    const submissions = await db
      .select()
      .from(tehillimList)
      .where(eq(tehillimList.userId, parseInt(session.user.id)))
      .orderBy(desc(tehillimList.createdAt));

    return NextResponse.json(submissions);
  } catch (error) {
    console.error("Failed to fetch user tehillim:", error);
    return NextResponse.json(
      { error: "Failed to fetch submissions" },
      { status: 500 }
    );
  }
}

// DELETE - Delete user's own tehillim submission
export async function DELETE(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be logged in" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Submission ID is required" },
        { status: 400 }
      );
    }

    // Only allow users to delete their own submissions
    const [deleted] = await db
      .delete(tehillimList)
      .where(
        and(
          eq(tehillimList.id, parseInt(id)),
          eq(tehillimList.userId, parseInt(session.user.id))
        )
      )
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: "Submission not found or you don't have permission to delete it" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error("Failed to delete tehillim:", error);
    return NextResponse.json(
      { error: "Failed to delete submission" },
      { status: 500 }
    );
  }
}
