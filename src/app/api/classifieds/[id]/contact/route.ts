import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { classifieds, classifiedContactLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resend, EMAIL_FROM } from "@/lib/email/resend";
import { getClassifiedContactEmailHtml } from "@/lib/email/templates";

const contactSchema = z.object({
  senderName: z.string().min(1, "Name is required").max(100),
  senderEmail: z.string().email("Invalid email address").max(255),
  message: z.string().min(1, "Message is required").max(1000, "Message must be 1,000 characters or less"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const classifiedId = parseInt(id);

    if (isNaN(classifiedId)) {
      return NextResponse.json({ error: "Invalid listing ID" }, { status: 400 });
    }

    const body = await request.json();
    const result = contactSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { senderName, senderEmail, message } = result.data;

    // Fetch the listing — only the fields we need
    const [listing] = await db
      .select({
        id: classifieds.id,
        title: classifieds.title,
        contactEmail: classifieds.contactEmail,
        approvalStatus: classifieds.approvalStatus,
        isActive: classifieds.isActive,
      })
      .from(classifieds)
      .where(eq(classifieds.id, classifiedId))
      .limit(1);

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (listing.approvalStatus !== "approved" || !listing.isActive) {
      return NextResponse.json({ error: "This listing is no longer available" }, { status: 400 });
    }

    if (!listing.contactEmail?.trim()) {
      return NextResponse.json({ error: "This listing does not have a contact email" }, { status: 400 });
    }

    // Get sender IP
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      null;

    // Log to database
    await db.insert(classifiedContactLog).values({
      classifiedId,
      senderName,
      senderEmail,
      message,
      ipAddress,
    });

    // Send relay email — failure should not fail the request
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    try {
      if (!resend) {
        console.error("[API] Resend not initialized — contact logged but email not sent for classified", classifiedId);
      } else {
        await resend.emails.send({
          from: EMAIL_FROM,
          to: listing.contactEmail,
          replyTo: senderEmail,
          subject: `Someone is interested in your listing: "${listing.title}"`,
          html: getClassifiedContactEmailHtml({
            listingTitle: listing.title,
            listingUrl: `${APP_URL}/classifieds/${listing.id}`,
            senderName,
            senderEmail,
            message,
          }),
        });
      }
    } catch (emailError) {
      console.error("[API] Failed to send contact relay email for classified", classifiedId, emailError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error processing classified contact:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
