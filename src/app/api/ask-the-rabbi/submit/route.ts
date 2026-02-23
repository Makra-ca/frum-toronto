import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { askTheRabbiSubmissions, formEmailRecipients } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { resend, EMAIL_FROM } from "@/lib/email/resend";

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

    // Get email recipients for Ask the Rabbi submissions
    const recipients = await db
      .select()
      .from(formEmailRecipients)
      .where(
        and(
          eq(formEmailRecipients.formType, "ask_the_rabbi"),
          eq(formEmailRecipients.isActive, true)
        )
      );

    // Send notification emails to configured recipients
    if (resend && recipients.length > 0) {
      const recipientEmails = recipients.map((r) => r.email);
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #7c3aed; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
            .question-box { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #7c3aed; }
            .meta { color: #6b7280; font-size: 14px; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
            .btn { display: inline-block; background: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">New Ask The Rabbi Question</h2>
            </div>
            <div class="content">
              <p class="meta"><strong>Submitted by:</strong> ${name} (${email})</p>
              <p class="meta"><strong>Submission ID:</strong> #${submission.id}</p>

              <div class="question-box">
                <p style="margin: 0; white-space: pre-wrap;">${question}</p>
              </div>

              ${imageUrl ? `<p class="meta"><strong>Image attached:</strong> <a href="${imageUrl}">View Image</a></p>` : ""}

              <a href="${APP_URL}/admin" class="btn">View in Admin Panel</a>
            </div>
            <div class="footer">
              <p>This is an automated notification from FrumToronto</p>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        await resend.emails.send({
          from: EMAIL_FROM,
          to: recipientEmails,
          subject: `New Ask The Rabbi Question from ${name}`,
          html: emailHtml,
          replyTo: email,
        });
      } catch (emailError) {
        // Log but don't fail the submission if email fails
        console.error("[API] Failed to send notification email:", emailError);
      }
    }

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
