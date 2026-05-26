import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET — paginated, filtered audit log (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const entityType = searchParams.get("entityType");
    const action = searchParams.get("action");
    const actorId = searchParams.get("actorId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const conditions = [];

    if (entityType) {
      conditions.push(eq(auditLog.entityType, entityType));
    }

    if (action) {
      conditions.push(eq(auditLog.action, action));
    }

    if (actorId) {
      conditions.push(eq(auditLog.actorId, parseInt(actorId)));
    }

    if (dateFrom) {
      conditions.push(gte(auditLog.createdAt, new Date(dateFrom)));
    }

    if (dateTo) {
      const dateToParsed = new Date(dateTo);
      // Include the full day
      dateToParsed.setHours(23, 59, 59, 999);
      conditions.push(lte(auditLog.createdAt, dateToParsed));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLog)
      .where(whereClause);

    const totalCount = Number(countResult?.count || 0);
    const totalPages = Math.ceil(totalCount / limit);

    const data = await db
      .select()
      .from(auditLog)
      .where(whereClause)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error("[API] Error fetching audit log:", error);
    return NextResponse.json({ error: "Failed to fetch audit log" }, { status: 500 });
  }
}
