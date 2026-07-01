import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { simchas, simchaTypes } from "@/lib/db/schema";
import { desc, eq, and, or, ilike, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createSchema = z.object({
  familyName: z.string().trim().min(1, "Family name is required").max(200),
  announcement: z.string().trim().min(1, "Announcement is required"),
  typeId: z.number().int().nullable().optional(),
  eventDate: z.string().optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  photoUrl: z.string().max(500).optional().nullable(),
});

// GET - List all simchas with pagination and filtering
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") || "all";
    const search = searchParams.get("search") || "";
    const offset = (page - 1) * limit;

    const conditions = [];

    // Status filter
    if (status !== "all") {
      conditions.push(eq(simchas.approvalStatus, status));
    }

    // Search filter
    if (search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(simchas.familyName, searchTerm),
          ilike(simchas.announcement, searchTerm),
          ilike(simchas.location, searchTerm)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get entries with type name
    const entries = await db
      .select({
        id: simchas.id,
        familyName: simchas.familyName,
        announcement: simchas.announcement,
        eventDate: simchas.eventDate,
        location: simchas.location,
        photoUrl: simchas.photoUrl,
        approvalStatus: simchas.approvalStatus,
        isActive: simchas.isActive,
        typeId: simchas.typeId,
        typeName: simchaTypes.name,
        createdAt: simchas.createdAt,
      })
      .from(simchas)
      .leftJoin(simchaTypes, eq(simchas.typeId, simchaTypes.id))
      .where(whereClause)
      .orderBy(desc(simchas.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(simchas)
      .where(whereClause);

    const totalCount = Number(countResult?.count || 0);

    return NextResponse.json({
      entries,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("[API] Error fetching simchas:", error);
    return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
  }
}

// POST - Admin creates a simcha (auto-approved)
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = createSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const d = result.data;
    const [created] = await db
      .insert(simchas)
      .values({
        userId: parseInt(session.user.id),
        familyName: d.familyName.trim(),
        announcement: d.announcement.trim(),
        typeId: d.typeId ?? null,
        eventDate: d.eventDate || null,
        location: d.location?.trim() || null,
        photoUrl: d.photoUrl || null,
        approvalStatus: "approved",
        isActive: true,
      })
      .returning();

    revalidatePath("/simchas");

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating simcha:", error);
    return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
  }
}
