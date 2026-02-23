import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { specials, businesses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { adminSpecialSchema } from "@/lib/validations/specials";

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
    const specialId = parseInt(id);

    const [special] = await db
      .select({
        id: specials.id,
        title: specials.title,
        description: specials.description,
        fileUrl: specials.fileUrl,
        fileType: specials.fileType,
        startDate: specials.startDate,
        endDate: specials.endDate,
        approvalStatus: specials.approvalStatus,
        isActive: specials.isActive,
        viewCount: specials.viewCount,
        createdAt: specials.createdAt,
        businessId: specials.businessId,
        businessName: businesses.name,
      })
      .from(specials)
      .leftJoin(businesses, eq(specials.businessId, businesses.id))
      .where(eq(specials.id, specialId))
      .limit(1);

    if (!special) {
      return NextResponse.json({ error: "Special not found" }, { status: 404 });
    }

    return NextResponse.json(special);
  } catch (error) {
    console.error("Error fetching special:", error);
    return NextResponse.json(
      { error: "Failed to fetch special" },
      { status: 500 }
    );
  }
}

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
    const specialId = parseInt(id);

    // Check if special exists
    const [existing] = await db
      .select({ id: specials.id })
      .from(specials)
      .where(eq(specials.id, specialId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Special not found" }, { status: 404 });
    }

    const body = await request.json();
    const result = adminSpecialSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { businessId, title, description, fileUrl, fileType, startDate, endDate, approvalStatus, isActive } = result.data;

    const [updated] = await db
      .update(specials)
      .set({
        businessId,
        title: title.trim(),
        description: description?.trim() || null,
        fileUrl,
        fileType,
        startDate,
        endDate,
        approvalStatus: approvalStatus || "approved",
        isActive: isActive ?? true,
        updatedAt: new Date(),
      })
      .where(eq(specials.id, specialId))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating special:", error);
    return NextResponse.json(
      { error: "Failed to update special" },
      { status: 500 }
    );
  }
}

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
    const specialId = parseInt(id);

    const [deleted] = await db
      .delete(specials)
      .where(eq(specials.id, specialId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Special not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting special:", error);
    return NextResponse.json(
      { error: "Failed to delete special" },
      { status: 500 }
    );
  }
}
