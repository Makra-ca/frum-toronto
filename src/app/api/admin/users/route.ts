import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { desc, eq, and, sql } from "drizzle-orm";
import {
  buildUserSearchCondition,
  buildUserStatusCondition,
  parseUserStatus,
} from "@/lib/admin/user-search";

const DEFAULT_LIMIT = 20;
/**
 * Hard ceiling. The legacy import took this table from 44 rows to ~3,150, so an
 * uncapped limit would let a caller pull the whole table in one request again.
 */
const MAX_LIMIT = 100;

const VALID_ROLES = ["admin", "shul", "business", "content_contributor", "member"];

/**
 * GET /api/admin/users?page=1&limit=20&search=&role=
 *
 * Returns { data, pagination } — the shape the other admin endpoints already
 * use. This replaced a bare array that selected every row with no limit; see the
 * 2026-07-29/30 legacy-import notes in CLAUDE.md.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    const pageRaw = Number.parseInt(searchParams.get("page") || "1", 10);
    const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

    const limitRaw = Number.parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const search = (searchParams.get("search") || "").trim();
    const role = searchParams.get("role") || "";
    const status = parseUserStatus(searchParams.get("status") ?? undefined);

    const conditions = [];

    const searchCondition = buildUserSearchCondition(search);
    if (searchCondition) conditions.push(searchCondition);

    if (role && role !== "all" && VALID_ROLES.includes(role)) {
      conditions.push(eq(users.role, role));
    }

    const statusCondition = buildUserStatusCondition(status);
    if (statusCondition) conditions.push(statusCondition);

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          isActive: users.isActive,
          isTrusted: users.isTrusted,
          emailVerified: users.emailVerified,
          createdAt: users.createdAt,
          canAutoApproveShiva: users.canAutoApproveShiva,
          canAutoApproveTehillim: users.canAutoApproveTehillim,
          canAutoApproveBusinesses: users.canAutoApproveBusinesses,
          canAutoApproveAskTheRabbi: users.canAutoApproveAskTheRabbi,
          canAutoApproveKosherAlerts: users.canAutoApproveKosherAlerts,
          canAutoApproveShuls: users.canAutoApproveShuls,
          canAutoApproveSimchas: users.canAutoApproveSimchas,
          canAutoApproveEvents: users.canAutoApproveEvents,
          canAutoApproveClassifieds: users.canAutoApproveClassifieds,
          canAutoApproveShiurim: users.canAutoApproveShiurim,
          canAutoApproveAlerts: users.canAutoApproveAlerts,
          canPostSpecials: users.canPostSpecials,
          canManageAskTheRabbi: users.canManageAskTheRabbi,
          commentPermission: users.commentPermission,
        })
        .from(users)
        .where(whereClause)
        // id breaks ties: the legacy import inserted thousands of rows in batches
        // sharing a created_at, and without a stable tiebreaker OFFSET paging can
        // repeat or skip rows.
        .orderBy(desc(users.createdAt), desc(users.id))
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ count: sql<number>`count(*)` }).from(users).where(whereClause),
    ]);

    const totalCount = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    return NextResponse.json({
      data: rows,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
