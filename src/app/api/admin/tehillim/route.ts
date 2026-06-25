import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { tehillimList } from "@/lib/db/schema";
import { desc, eq, and, or, ilike, sql } from "drizzle-orm";
import { z } from "zod";

const createSchema = z
  .object({
    hebrewName: z.string().trim().max(200).optional().nullable(),
    englishName: z.string().trim().max(200).optional().nullable(),
    motherHebrewName: z.string().trim().max(200).optional().nullable(),
    reason: z.string().trim().max(200).optional().nullable(),
    expiresAt: z.string().optional().nullable(),
    isPermanent: z.boolean().optional(),
  })
  .refine((d) => (d.hebrewName?.trim() || d.englishName?.trim()), {
    message: "Either Hebrew or English name is required",
  });

// GET - List all tehillim with pagination and filtering
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

    const archived = searchParams.get("archived") === "true";

    const conditions = [];

    // Active vs archived filter
    conditions.push(eq(tehillimList.isActive, !archived));

    // Status filter
    if (status !== "all") {
      conditions.push(eq(tehillimList.approvalStatus, status));
    }

    // Search filter
    if (search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(tehillimList.hebrewName, searchTerm),
          ilike(tehillimList.englishName, searchTerm),
          ilike(tehillimList.reason, searchTerm)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get entries
    const entries = await db
      .select()
      .from(tehillimList)
      .where(whereClause)
      .orderBy(desc(tehillimList.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tehillimList)
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
    console.error("[API] Error fetching tehillim:", error);
    return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
  }
}

// POST - Admin creates a tehillim entry (auto-approved)
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
      .insert(tehillimList)
      .values({
        userId: parseInt(session.user.id),
        hebrewName: d.hebrewName?.trim() || null,
        englishName: d.englishName?.trim() || null,
        motherHebrewName: d.motherHebrewName?.trim() || null,
        reason: d.reason?.trim() || null,
        expiresAt: d.expiresAt || null,
        isPermanent: d.isPermanent ?? false,
        approvalStatus: "approved",
        isActive: true,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating tehillim entry:", error);
    return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
  }
}
