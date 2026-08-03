import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { askTheRabbi, users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { notifyAdminOfSubmission } from "@/lib/notifications";
import { assertCanPost } from "@/lib/auth/require-verified";
import { fromDateTimeInputs } from "@/lib/datetime";

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
  // The form has always sent this; the schema never listed it, and z.object()
  // strips unknown keys silently, so the value was discarded.
  publishedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected yyyy-mm-dd")
    // The regex alone admits 2026-13-45, and fromDateTimeInputs uses the same
    // pattern, so it would not reject it either — the date would silently roll
    // over into the next month. Require the parse to round-trip.
    .refine((v) => fromDateTimeInputs(v).slice(0, 10) === v, "Not a real calendar date")
    .optional(),
});

// POST /api/ask-the-rabbi/quick-post
// Requires canManageAskTheRabbi — publishes a Q&A immediately
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Submissions require a verified email address (admins exempt). Also
    // re-checks the account is not disabled, since a session can outlive a block.
    const notAllowed = await assertCanPost(session?.user?.id);
    if (notAllowed) return notAllowed;

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

    const { title, question, answer, category, answeredBy, publishedAt } = result.data;

    // answeredBy is deliberately NOT defaulted here. The column already
    // defaults to "Hagaon Rav Shlomo Miller Shlit'a" (schema.ts), and the old
    // fallback chain substituted the session user's name over it — which is why
    // nine published Q&As were credited to "Admin User" instead of the Rav.
    // Omit the key when the form sends nothing and let the column default win.

    // Next question number. NOT atomic despite what the old comment claimed —
    // this is a separate SELECT, so two concurrent publishes could collide on
    // the question_number unique index. Acceptable at one or two posts a week;
    // revisit if that changes.
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
        ...(answeredBy ? { answeredBy } : {}),
        isPublished: true,
        publishedAt: publishedAt
          ? new Date(fromDateTimeInputs(publishedAt))
          : new Date(),
      })
      .returning();

    // Notify admins (Tier C FYI — published instantly by an ATR manager)
    await notifyAdminOfSubmission({
      contentType: "atr_quick_post",
      title: `Ask the Rabbi Q&A published: ${title}`,
      body:
        `Question #${nextQuestionNumber}: ${title}\n` +
        `Published by: ${session.user.name || session.user.email || "Unknown user"}`,
      linkUrl: `/ask-the-rabbi/${newQuestion.id}`,
      status: "auto_approved",
    });

    return NextResponse.json(newQuestion, { status: 201 });
  } catch (error) {
    console.error("[ATR QUICK-POST] Error:", error);
    return NextResponse.json({ error: "Failed to publish question" }, { status: 500 });
  }
}
