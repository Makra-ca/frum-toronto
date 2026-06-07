import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { askTheRabbiSubmissions } from "@/lib/db/schema";
import { z } from "zod";
import { notifyAdminOfSubmission } from "@/lib/notifications";

const submitSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Valid email is required").max(255),
  question: z.string().min(10, "Question must be at least 10 characters").max(5000),
  imageUrl: z.string().max(500).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const session = await auth();

  // Require authentication
  if (!session?.user) {
    return NextResponse.json(
      { error: "You must be logged in to submit a question" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const result = submitSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, email, question, imageUrl } = result.data;

    // Save to database
    const [submission] = await db
      .insert(askTheRabbiSubmissions)
      .values({
        userId: parseInt(session.user.id),
        name,
        email,
        question,
        imageUrl: imageUrl || null,
        status: "pending",
      })
      .returning();

    // Notify admins (in-app + instant email to ask_the_rabbi recipients)
    await notifyAdminOfSubmission({
      contentType: "ask_the_rabbi",
      title: `New Ask The Rabbi Question from ${name}`,
      body:
        `Submitted by: ${name} (${email})\n` +
        `Submission ID: #${submission.id}\n\n` +
        `${question}` +
        (imageUrl ? `\n\nImage attached: ${imageUrl}` : ""),
      linkUrl: "/admin/programs/rabbi",
      status: "pending",
      replyTo: email,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Your question has been submitted successfully. You will receive a response via email.",
        submissionId: submission.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API] Error submitting question:", error);
    return NextResponse.json(
      { error: "Failed to submit question. Please try again." },
      { status: 500 }
    );
  }
}
