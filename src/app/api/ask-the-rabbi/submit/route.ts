import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { askTheRabbiSubmissions, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { notifyAdminOfSubmission } from "@/lib/notifications";
import { assertCanPost } from "@/lib/auth/require-verified";

/**
 * `name` and `email` are deliberately NOT in this schema.
 *
 * They used to be taken from the request body. `userId` was session-derived and
 * correct, but the *displayed* identity in the admin queue, and the `replyTo`
 * the admin's answer is addressed to, were both whatever the submitter typed —
 * so a question could arrive signed as someone else, with the rabbi's reply
 * routed to an address of the sender's choosing.
 *
 * Both now come from the account. The form already prefilled them from the
 * session, so this changes nothing for an honest submission.
 */
const submitSchema = z.object({
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

  // Submissions require a verified email address (admins exempt). Also
  // re-checks the account is not disabled, since a session can outlive a block.
  const notAllowed = await assertCanPost(session?.user?.id);
  if (notAllowed) return notAllowed;

  try {
    const body = await request.json();
    const result = submitSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { question, imageUrl } = result.data;

    const userId = parseInt(session.user.id);
    const [account] = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!account?.email) {
      // assertCanPost already proved the row exists and is active, so this is
      // unreachable in practice — but the reply address must never be blank.
      return NextResponse.json(
        { error: "Your account has no email address on file." },
        { status: 400 }
      );
    }

    const email = account.email;
    const name =
      [account.firstName, account.lastName].filter(Boolean).join(" ").trim() ||
      account.email;

    // Save to database
    const [submission] = await db
      .insert(askTheRabbiSubmissions)
      .values({
        userId,
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
      linkUrl: "/admin/programs/rabbi?tab=submissions",
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
