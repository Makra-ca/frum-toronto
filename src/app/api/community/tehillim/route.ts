import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { tehillimList } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// GET - Fetch all approved, active tehillim names
export async function GET() {
  try {
    const names = await db
      .select()
      .from(tehillimList)
      .where(
        and(
          eq(tehillimList.approvalStatus, "approved"),
          eq(tehillimList.isActive, true)
        )
      );

    return NextResponse.json(names);
  } catch (error) {
    console.error("Failed to fetch tehillim list:", error);
    return NextResponse.json(
      { error: "Failed to fetch tehillim list" },
      { status: 500 }
    );
  }
}

// POST - Submit a new tehillim name (requires login, goes to pending)
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be logged in to add a name" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { hebrewName, englishName, motherHebrewName, reason } = body;

    const hasHebrewName = hebrewName && hebrewName.trim() !== "";
    const hasEnglishName = englishName && englishName.trim() !== "";

    if (!hasHebrewName && !hasEnglishName) {
      return NextResponse.json(
        { error: "Either Hebrew name or English name is required" },
        { status: 400 }
      );
    }

    const [newEntry] = await db
      .insert(tehillimList)
      .values({
        userId: parseInt(session.user.id),
        hebrewName: hebrewName?.trim() || null,
        englishName: englishName?.trim() || null,
        motherHebrewName: motherHebrewName?.trim() || null,
        reason: reason?.trim() || null,
        isActive: true,
        approvalStatus: "pending",
      })
      .returning();

    return NextResponse.json({
      message: "Name submitted successfully. It will appear after admin approval.",
      entry: newEntry,
    });
  } catch (error) {
    console.error("Failed to add tehillim name:", error);
    return NextResponse.json(
      { error: "Failed to add name" },
      { status: 500 }
    );
  }
}
