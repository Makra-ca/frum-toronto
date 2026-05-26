import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import {
  askTheRabbi,
  askTheRabbiSubmissions,
  emailSubscribers,
  notifications,
  users,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { resend, EMAIL_FROM } from "@/lib/email/resend";
import { generateAtrAnswerNotificationEmail } from "@/lib/email/templates";

export const dynamic = "force-dynamic";

const answerSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(255),
  question: z.string().trim().min(1, "Question is required"),
  answer: z.string().trim().min(1, "Answer is required"),
  category: z.string().trim().max(100).optional(),
  answeredBy: z.string().trim().max(200).optional(),
});

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

// POST /api/admin/ask-the-rabbi/submissions/[id]/answer
// Publishes an answer to a submission, sends notification to submitter
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!(await isAuthorized(session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const submissionId = parseInt(id);

    if (isNaN(submissionId)) {
      return NextResponse.json({ error: "Invalid submission ID" }, { status: 400 });
    }

    // Fetch the submission
    const [submission] = await db
      .select()
      .from(askTheRabbiSubmissions)
      .where(eq(askTheRabbiSubmissions.id, submissionId))
      .limit(1);

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    if (submission.status === "answered") {
      return NextResponse.json(
        { error: "This submission has already been answered." },
        { status: 409 }
      );
    }

    const body = await request.json();
    const result = answerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { title, question, answer, category, answeredBy } = result.data;

    const resolvedAnsweredBy =
      answeredBy || "Hagaon Rav Shlomo Miller Shlit'a";

    // Get next question number
    const [maxResult] = await db
      .select({ max: sql<number>`COALESCE(MAX(question_number), 0)` })
      .from(askTheRabbi);
    const nextQuestionNumber = (maxResult?.max || 0) + 1;

    // Insert public question
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

    // Update submission to answered
    const [updatedSubmission] = await db
      .update(askTheRabbiSubmissions)
      .set({
        status: "answered",
        reviewedAt: new Date(),
        reviewedBy: parseInt(session!.user!.id),
        publishedQuestionId: newQuestion.id,
        adminNotes: `Published as question #${nextQuestionNumber}`,
      })
      .where(eq(askTheRabbiSubmissions.id, submissionId))
      .returning();

    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://frumtoronto.com";
    const questionUrl = `${APP_URL}/ask-the-rabbi/${newQuestion.id}`;

    // Create in-app notification if submitter has a userId
    if (submission.userId) {
      try {
        await db.insert(notifications).values({
          userId: submission.userId,
          type: "atr_answered",
          title: "Your question has been answered",
          body: `"${title}" has been answered on FrumToronto.`,
          linkUrl: questionUrl,
          isRead: false,
        });
      } catch (notifError) {
        console.error("[ATR NOTIFY] Failed to create in-app notification:", notifError);
      }
    }

    // Send email notification if submitter opted in
    if (submission.email) {
      try {
        // Check if submitter has askTheRabbiAnswered preference enabled
        let shouldSendEmail = true;

        if (submission.userId) {
          const [subscriber] = await db
            .select({ askTheRabbiAnswered: emailSubscribers.askTheRabbiAnswered })
            .from(emailSubscribers)
            .where(eq(emailSubscribers.userId, submission.userId))
            .limit(1);

          // If they have a subscriber record, respect their preference
          if (subscriber !== undefined) {
            shouldSendEmail = subscriber.askTheRabbiAnswered;
          }
        }

        if (shouldSendEmail && resend) {
          const html = generateAtrAnswerNotificationEmail({
            questionTitle: title,
            questionUrl,
            answeredBy: resolvedAnsweredBy,
            recipientName: submission.name,
          });

          await resend.emails.send({
            from: EMAIL_FROM,
            to: submission.email,
            subject: "Your question has been answered — FrumToronto",
            html,
          });
        }
      } catch (emailError) {
        console.error(
          `[ATR NOTIFY] Email failed for submission ${submissionId}:`,
          emailError
        );
        // Do NOT fail the request — email failure must not block publish
      }
    }

    return NextResponse.json({
      question: newQuestion,
      submission: updatedSubmission,
    });
  } catch (error) {
    console.error("[ATR ANSWER] Error publishing answer:", error);
    return NextResponse.json({ error: "Failed to publish answer" }, { status: 500 });
  }
}
