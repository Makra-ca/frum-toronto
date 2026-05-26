import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businessShoutouts, businesses } from "@/lib/db/schema";
import { eq, asc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/admin/shoutouts - List all shoutouts with business name
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending_approval";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const whereClause = status !== "all" ? eq(businessShoutouts.status, status) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(businessShoutouts)
      .where(whereClause);

    const totalCount = Number(countResult?.count || 0);

    const shoutouts = await db
      .select({
        id: businessShoutouts.id,
        businessId: businessShoutouts.businessId,
        businessName: businesses.name,
        businessSlug: businesses.slug,
        scheduledDate: businessShoutouts.scheduledDate,
        contentHtml: businessShoutouts.contentHtml,
        contentJson: businessShoutouts.contentJson,
        imageUrl: businessShoutouts.imageUrl,
        status: businessShoutouts.status,
        rejectionReason: businessShoutouts.rejectionReason,
        createdAt: businessShoutouts.createdAt,
        updatedAt: businessShoutouts.updatedAt,
      })
      .from(businessShoutouts)
      .leftJoin(businesses, eq(businessShoutouts.businessId, businesses.id))
      .where(whereClause)
      .orderBy(asc(businessShoutouts.scheduledDate))
      .limit(limit)
      .offset(offset);

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      data: shoutouts,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error("[Admin Shoutouts GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch shoutouts" },
      { status: 500 }
    );
  }
}
