import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { canManageAtr } from "@/lib/auth/atr-permissions";
import { fromDateTimeInputs } from "@/lib/datetime";
import { db } from "@/lib/db";
import { askTheRabbi, askTheRabbiComments } from "@/lib/db/schema";
import { eq, desc, sql, and, ilike, or } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET /api/admin/ask-the-rabbi
// Returns paginated list of all questions (published and unpublished)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!(await canManageAtr(session))) {
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
      // Newest question first by publication date, NOT by insertion order.
      // desc(id) showed rows in the order they were typed, which is why
      // #6024 (posted 7/30) sat above #6019 (posted 8/3), and why the legacy
      // archive import would otherwise land on top of recent posts.
      // NULLS LAST: Postgres sorts NULLs FIRST on DESC, so an unpublished row
      // with no date would otherwise head the list.
      .orderBy(sql`${askTheRabbi.publishedAt} DESC NULLS LAST`, desc(askTheRabbi.id))
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
  // Constrained so a malformed value cannot become an Invalid Date in the
  // update below. See the same shape in quick-post/route.ts.
  publishedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected yyyy-mm-dd")
    .refine((v) => fromDateTimeInputs(v).slice(0, 10) === v, "Not a real calendar date")
    .optional()
    .nullable(),
});

// PATCH /api/admin/ask-the-rabbi (with ?id=xxx)
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!(await canManageAtr(session))) {
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
    }

    // Parsed as a Toronto day. new Date("2026-05-02") is UTC midnight, which
    // renders as 5/1/2026 in America/Toronto — the whole date lands a day early.
    if (result.data.publishedAt !== undefined) {
      updates.publishedAt = result.data.publishedAt
        ? new Date(fromDateTimeInputs(result.data.publishedAt))
        : null;
    }

    // "Publish with no date" means publish now. This must come AFTER the
    // explicit value above: the two used to run in the opposite order, so the
    // null branch overwrote the timestamp this one had just set, and the edit
    // dialog sends `publishedAt: publishedAt || null` — meaning publishing with
    // the date box empty stored NULL every time.
    if (result.data.isPublished && !updates.publishedAt) {
      updates.publishedAt = new Date();
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
    if (!(await canManageAtr(session))) {
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
