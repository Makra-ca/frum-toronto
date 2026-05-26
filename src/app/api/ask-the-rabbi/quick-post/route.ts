import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { askTheRabbi, users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const quickPostSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(255),
  question: z
    .string()
    .trim()
    .min(20, "Question must be at least 20 characters"),
  answer: z.string().trim().min(20, "Answer must be at least 20 characters"),
  category: z.string().trim().max(100).optional(),
  answeredBy: z.string().trim().max(200).optional(),
});

// POST /api/ask-the-rabbi/quick-post
// Requires canManageAskTheRabbi — publishes a Q&A immediately
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);

    // Check canManageAskTheRabbi or admin
    if (session.user.role !== "admin") {
      const [dbUser] = await db
        .select({ canManageAskTheRabbi: users.canManageAskTheRabbi })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!dbUser?.canManageAskTheRabbi) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await request.json();
    const result = quickPostSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { title, question, answer, category, answeredBy } = result.data;

    // Determine answeredBy — fall back to session name or default
    const resolvedAnsweredBy =
      answeredBy ||
      [session.user.name].filter(Boolean).join("") ||
      "FrumToronto Rabbi";

    // Get next question number (compute inside the insert for safety)
    const [maxResult] = await db
      .select({ max: sql<number>`COALESCE(MAX(question_number), 0)` })
      .from(askTheRabbi);
    const nextQuestionNumber = (maxResult?.max || 0) + 1;

    const [newQuestion] = await db
      .insert(askTheRabbi)
      .values({
        questionNumber: nextQuestionNumber,
        title,
        question,
        answer,
        category: category || null,
        answeredBy: resolvedAnsweredBy,
        isPublished: true,
        publishedAt: new Date(),
      })
      .returning();

    return NextResponse.json(newQuestion, { status: 201 });
  } catch (error) {
    console.error("[ATR QUICK-POST] Error:", error);
    return NextResponse.json({ error: "Failed to publish question" }, { status: 500 });
  }
}
