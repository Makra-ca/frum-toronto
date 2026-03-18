import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { eruvStatus } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// PATCH - Update an eruv status entry
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
    const eruvId = parseInt(id);

    if (isNaN(eruvId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.statusDate !== undefined) {
      updates.statusDate = body.statusDate;
    }
    if (body.isUp !== undefined) {
      updates.isUp = body.isUp;
    }
    if (body.message !== undefined) {
      updates.message = body.message?.trim() || null;
    }

    updates.updatedBy = parseInt(session.user.id);
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(eruvStatus)
      .set(updates)
      .where(eq(eruvStatus.id, eruvId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[API] Error updating eruv status:", error);
    return NextResponse.json({ error: "Failed to update eruv status" }, { status: 500 });
  }
}
