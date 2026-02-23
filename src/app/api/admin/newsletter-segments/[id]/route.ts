import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { newsletterSegments } from "@/lib/db/schema";
import { segmentSchema } from "@/lib/validations/newsletter";
import { eq } from "drizzle-orm";

// GET - Get single segment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const segmentId = parseInt(id);

    if (isNaN(segmentId)) {
      return NextResponse.json(
        { error: "Invalid segment ID" },
        { status: 400 }
      );
    }

    const [segment] = await db
      .select()
      .from(newsletterSegments)
      .where(eq(newsletterSegments.id, segmentId))
      .limit(1);

    if (!segment) {
      return NextResponse.json(
        { error: "Segment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(segment);
  } catch (error) {
    console.error("Error fetching segment:", error);
    return NextResponse.json(
      { error: "Failed to fetch segment" },
      { status: 500 }
    );
  }
}

// PUT - Update segment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const segmentId = parseInt(id);

    if (isNaN(segmentId)) {
      return NextResponse.json(
        { error: "Invalid segment ID" },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(newsletterSegments)
      .where(eq(newsletterSegments.id, segmentId))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Segment not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = segmentSchema.parse(body);

    // If this is set as default, unset other defaults
    if (validatedData.isDefault && !existing.isDefault) {
      await db
        .update(newsletterSegments)
        .set({ isDefault: false });
    }

    const [updated] = await db
      .update(newsletterSegments)
      .set({
        name: validatedData.name,
        description: validatedData.description || null,
        filterCriteria: validatedData.filterCriteria || null,
        isDefault: validatedData.isDefault || false,
      })
      .where(eq(newsletterSegments.id, segmentId))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating segment:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid data", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update segment" },
      { status: 500 }
    );
  }
}

// DELETE - Delete segment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const segmentId = parseInt(id);

    if (isNaN(segmentId)) {
      return NextResponse.json(
        { error: "Invalid segment ID" },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(newsletterSegments)
      .where(eq(newsletterSegments.id, segmentId))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Segment not found" },
        { status: 404 }
      );
    }

    await db
      .delete(newsletterSegments)
      .where(eq(newsletterSegments.id, segmentId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting segment:", error);
    return NextResponse.json(
      { error: "Failed to delete segment" },
      { status: 500 }
    );
  }
}
