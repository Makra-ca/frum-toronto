import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { newsletters } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resend, EMAIL_FROM } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

const PREVIEW_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const newsletterId = parseInt(id);
    if (isNaN(newsletterId)) {
      return NextResponse.json({ error: "Invalid newsletter ID" }, { status: 400 });
    }

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email address required" }, { status: 400 });
    }

    // Fetch newsletter
    const [newsletter] = await db
      .select({
        id: newsletters.id,
        subject: newsletters.subject,
        previewHtml: newsletters.previewHtml,
        previewGeneratedAt: newsletters.previewGeneratedAt,
      })
      .from(newsletters)
      .where(eq(newsletters.id, newsletterId))
      .limit(1);

    if (!newsletter) {
      return NextResponse.json({ error: "Newsletter not found" }, { status: 404 });
    }

    if (!newsletter.previewHtml) {
      return NextResponse.json(
        { error: "No preview generated yet. Click 'Preview Email' first." },
        { status: 400 }
      );
    }

    // Validate preview is not expired (30 min)
    if (newsletter.previewGeneratedAt) {
      const age = Date.now() - new Date(newsletter.previewGeneratedAt).getTime();
      if (age > PREVIEW_MAX_AGE_MS) {
        return NextResponse.json(
          { error: "Preview has expired. Regenerate the preview before sending a test." },
          { status: 400 }
        );
      }
    }

    if (!resend) {
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      );
    }

    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: `[TEST] ${newsletter.subject}`,
      html: newsletter.previewHtml,
    });

    if (error) {
      console.error("[TEST-SEND] Resend error:", error);
      return NextResponse.json(
        { error: "Failed to send test email" },
        { status: 500 }
      );
    }

    console.log(`[TEST-SEND] Test email for newsletter ${newsletterId} sent to ${email}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[TEST-SEND] Error:", error);
    return NextResponse.json({ error: "Failed to send test email" }, { status: 500 });
  }
}
