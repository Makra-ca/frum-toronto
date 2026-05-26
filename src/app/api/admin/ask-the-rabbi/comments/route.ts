import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import {
  askTheRabbiComments,
  askTheRabbi,
  users,
} from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Auth guard: admin or canManageAskTheRabbi
async function isAuthorized(session: Awaited<ReturnType<typeof auth>>) {
  if (!session?.user?.id) return false;
  if (session.user.role === "admin") return true;

  const [dbUser] = await db
    .select({ canManageAskTheRabbi: users.canManageAskTheRabbi })
    .from(users)
    .where(eq(users.id, parseInt(session.user.id)))
    .limit(1);

  return dbUser?.canManageAskTheRabbi === true;
}

// GET /api/admin/ask-the-rabbi/comments
// Returns paginated comment list with optional status filter
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!(await isAuthorized(session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";
    const questionId = searchParams.get("questionId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    const conditions = [];

    if (status !== "all") {
      conditions.push(eq(askTheRabbiComments.approvalStatus, status));
    }

    if (questionId) {
      const qId = parseInt(questionId);
      if (!isNaN(qId)) {
        conditions.push(eq(askTheRabbiComments.questionId, qId));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const comments = await db
      .select({
        id: askTheRabbiComments.id,
        questionId: askTheRabbiComments.questionId,
        authorId: askTheRabbiComments.authorId,
        content: askTheRabbiComments.content,
        parentId: askTheRabbiComments.parentId,
        approvalStatus: askTheRabbiComments.approvalStatus,
        isActive: askTheRabbiComments.isActive,
        createdAt: askTheRabbiComments.createdAt,
        // Question title via join
        questionTitle: askTheRabbi.title,
        // Author name via join
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
      })
      .from(askTheRabbiComments)
      .leftJoin(askTheRabbi, eq(askTheRabbiComments.questionId, askTheRabbi.id))
      .leftJoin(users, eq(askTheRabbiComments.authorId, users.id))
      .where(whereClause)
      .orderBy(desc(askTheRabbiComments.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(askTheRabbiComments)
      .where(whereClause);

    const totalCount = Number(countResult?.count || 0);

    const mapped = comments.map((c) => ({
      ...c,
      authorName:
        [c.authorFirstName, c.authorLastName].filter(Boolean).join(" ") || "Anonymous",
    }));

    return NextResponse.json({
      comments: mapped,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("[ADMIN ATR COMMENTS] Error fetching comments:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}
