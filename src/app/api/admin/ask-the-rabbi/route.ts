import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { askTheRabbi, askTheRabbiComments, users } from "@/lib/db/schema";
import { eq, desc, sql, and, ilike, or } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Auth guard: admin or canManageAskTheRabbi
async function isAuthorized(session: import("next-auth").Session | null) {
  if (!session?.user?.id) return false;
  if (session.user.role === "admin") return true;

  const [dbUser] = await db
    .select({ canManageAskTheRabbi: users.canManageAskTheRabbi })
    .from(users)
    .where(eq(users.id, parseInt(session.user.id)))
    .limit(1);

  return dbUser?.canManageAskTheRabbi === true;
}

// GET /api/admin/ask-the-rabbi
// Returns paginated list of all questions (published and unpublished)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!(await isAuthorized(session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const offset = (page - 1) * limit;
    const search = searchParams.get("search") || "";
    const published = searchParams.get("published"); // "true" | "false" | null (all)

    const conditions = [];

    if (published === "true") {
      conditions.push(eq(askTheRabbi.isPublished, true));
    } else if (published === "false") {
      conditions.push(eq(askTheRabbi.isPublished, false));
    }

    if (search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(askTheRabbi.title, term),
          ilike(askTheRabbi.question, term)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get questions with comment count
    const questions = await db
      .select({
        id: askTheRabbi.id,
        questionNumber: askTheRabbi.questionNumber,
        title: askTheRabbi.title,
        question: askTheRabbi.question,
        answer: askTheRabbi.answer,
        answeredBy: askTheRabbi.answeredBy,
        isPublished: askTheRabbi.isPublished,
        publishedAt: askTheRabbi.publishedAt,
        viewCount: askTheRabbi.viewCount,
        commentCount: sql<number>`(
          SELECT COUNT(*) FROM ask_the_rabbi_comments
          WHERE question_id = ${askTheRabbi.id}
          AND approval_status = 'approved'
          AND is_active = true
        )`,
      })
      .from(askTheRabbi)
      .where(whereClause)
      .orderBy(desc(askTheRabbi.id))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(askTheRabbi)
      .where(whereClause);

    const totalCount = Number(countResult?.count || 0);

    return NextResponse.json({
      questions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("[ADMIN ATR] Error fetching questions:", error);
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
  }
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  question: z.string().trim().min(1).optional(),
  answer: z.string().trim().optional().nullable(),
  answeredBy: z.string().trim().max(200).optional().nullable(),
  isPublished: z.boolean().optional(),
  publishedAt: z.string().optional().nullable(),
});

// PATCH /api/admin/ask-the-rabbi (with ?id=xxx)
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!(await isAuthorized(session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get("id") || "");

    if (isNaN(id)) {
      return NextResponse.json({ error: "Missing or invalid id param" }, { status: 400 });
    }

    const body = await request.json();
    const result = patchSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (result.data.title !== undefined) updates.title = result.data.title;
    if (result.data.question !== undefined) updates.question = result.data.question;
    if (result.data.answer !== undefined) updates.answer = result.data.answer;
    if (result.data.answeredBy !== undefined) updates.answeredBy = result.data.answeredBy;
    if (result.data.isPublished !== undefined) {
      updates.isPublished = result.data.isPublished;
      if (result.data.isPublished && !result.data.publishedAt) {
        updates.publishedAt = new Date();
      }
    }
    if (result.data.publishedAt !== undefined) {
      updates.publishedAt = result.data.publishedAt ? new Date(result.data.publishedAt) : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const [updated] = await db
      .update(askTheRabbi)
      .set(updates)
      .where(eq(askTheRabbi.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[ADMIN ATR] Error updating question:", error);
    return NextResponse.json({ error: "Failed to update question" }, { status: 500 });
  }
}

// DELETE /api/admin/ask-the-rabbi?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!(await isAuthorized(session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get("id") || "");

    if (isNaN(id)) {
      return NextResponse.json({ error: "Missing or invalid id param" }, { status: 400 });
    }

    await db.delete(askTheRabbiComments).where(eq(askTheRabbiComments.questionId, id));
    const [deleted] = await db.delete(askTheRabbi).where(eq(askTheRabbi.id, id)).returning();

    if (!deleted) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADMIN ATR] Error deleting question:", error);
    return NextResponse.json({ error: "Failed to delete question" }, { status: 500 });
  }
}
