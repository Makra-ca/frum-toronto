import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { askTheRabbiSubmissions, askTheRabbi, users } from "@/lib/db/schema";
import { desc, eq, sql, and } from "drizzle-orm";
import { z } from "zod";

// GET - List all submissions with optional filtering
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status !== "all") {
      conditions.push(eq(askTheRabbiSubmissions.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get submissions with user info
    const submissions = await db
      .select({
        id: askTheRabbiSubmissions.id,
        userId: askTheRabbiSubmissions.userId,
        name: askTheRabbiSubmissions.name,
        email: askTheRabbiSubmissions.email,
        question: askTheRabbiSubmissions.question,
        imageUrl: askTheRabbiSubmissions.imageUrl,
        status: askTheRabbiSubmissions.status,
        adminNotes: askTheRabbiSubmissions.adminNotes,
        createdAt: askTheRabbiSubmissions.createdAt,
        reviewedAt: askTheRabbiSubmissions.reviewedAt,
      })
      .from(askTheRabbiSubmissions)
      .where(whereClause)
      .orderBy(desc(askTheRabbiSubmissions.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(askTheRabbiSubmissions)
      .where(whereClause);

    const totalCount = Number(countResult?.count || 0);

    // Get counts by status for tabs
    const statusCounts = await db
      .select({
        status: askTheRabbiSubmissions.status,
        count: sql<number>`count(*)`,
      })
      .from(askTheRabbiSubmissions)
      .groupBy(askTheRabbiSubmissions.status);

    const counts = {
      all: totalCount,
      pending: 0,
      answered: 0,
      rejected: 0,
    };
    statusCounts.forEach((s) => {
      if (s.status in counts) {
        counts[s.status as keyof typeof counts] = Number(s.count);
      }
    });
    counts.all = counts.pending + counts.answered + counts.rejected;

    return NextResponse.json({
      submissions,
      counts,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("[API] Error fetching rabbi submissions:", error);
    return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 });
  }
}

// POST - Publish a submission (create public question with answer)
const publishSchema = z.object({
  submissionId: z.number(),
  title: z.string().min(1, "Title is required").max(255),
  question: z.string().min(1, "Question is required"),
  answer: z.string().min(1, "Answer is required"),
  category: z.string().optional(),
  answeredBy: z.string().max(200).optional(),
  imageUrl: z.string().max(500).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = publishSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { submissionId, title, question, answer, category, answeredBy, imageUrl } = result.data;

    // Check submission exists and is pending
    const [submission] = await db
      .select()
      .from(askTheRabbiSubmissions)
      .where(eq(askTheRabbiSubmissions.id, submissionId))
      .limit(1);

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    if (submission.status === "answered") {
      return NextResponse.json({ error: "This submission has already been answered" }, { status: 400 });
    }

    // Get next question number
    const [maxResult] = await db
      .select({ max: sql<number>`COALESCE(MAX(question_number), 0)` })
      .from(askTheRabbi);
    const nextQuestionNumber = (maxResult?.max || 0) + 1;

    // Create public question
    const [publicQuestion] = await db
      .insert(askTheRabbi)
      .values({
        questionNumber: nextQuestionNumber,
        title,
        question,
        answer,
        category: category || null,
        answeredBy: answeredBy || "Hagaon Rav Shlomo Miller Shlit'a",
        imageUrl: imageUrl || null,
        isPublished: true,
        publishedAt: new Date(),
      })
      .returning();

    // Update submission status and link to published question
    await db
      .update(askTheRabbiSubmissions)
      .set({
        status: "answered",
        reviewedAt: new Date(),
        reviewedBy: parseInt(session.user.id),
        publishedQuestionId: publicQuestion.id,
        adminNotes: `Published as question #${nextQuestionNumber}`,
      })
      .where(eq(askTheRabbiSubmissions.id, submissionId));

    return NextResponse.json({
      success: true,
      questionNumber: nextQuestionNumber,
      questionId: publicQuestion.id,
    });
  } catch (error) {
    console.error("[API] Error publishing question:", error);
    return NextResponse.json({ error: "Failed to publish question" }, { status: 500 });
  }
}
