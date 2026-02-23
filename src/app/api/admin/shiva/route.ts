import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shivaNotifications } from "@/lib/db/schema";
import { desc, eq, and, or, ilike, sql } from "drizzle-orm";

// GET - List all shiva notices with pagination and filtering
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
      conditions.push(eq(shivaNotifications.approvalStatus, status));
    }

    // Search filter
    if (search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(shivaNotifications.niftarName, searchTerm),
          ilike(shivaNotifications.niftarNameHebrew, searchTerm),
          ilike(shivaNotifications.shivaAddress, searchTerm)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get entries
    const entries = await db
      .select()
      .from(shivaNotifications)
      .where(whereClause)
      .orderBy(desc(shivaNotifications.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(shivaNotifications)
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
    console.error("[API] Error fetching shiva notices:", error);
    return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
  }
}
