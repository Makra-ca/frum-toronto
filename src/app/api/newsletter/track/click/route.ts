import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsletterRecipientLogs, newsletterSends } from "@/lib/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Track newsletter link clicks and redirect to destination
 * GET /api/newsletter/track/click?sid=123&sub=456&url=https://example.com
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sendId = searchParams.get("sid");
  const subscriberId = searchParams.get("sub");
  const destinationUrl = searchParams.get("url");

  // Validate destination URL
  if (!destinationUrl) {
    return NextResponse.redirect(APP_URL);
  }

  // Decode URL if it was encoded
  let redirectUrl: string;
  try {
    redirectUrl = decodeURIComponent(destinationUrl);
    // Basic URL validation
    new URL(redirectUrl);
  } catch {
    // Invalid URL, redirect to home
    return NextResponse.redirect(APP_URL);
  }

  // Track the click if we have valid params
  if (sendId && subscriberId) {
    const sendIdNum = parseInt(sendId);
    const subIdNum = parseInt(subscriberId);

    if (!isNaN(sendIdNum) && !isNaN(subIdNum)) {
      try {
        // Update recipient log only if not already clicked
        const result = await db
          .update(newsletterRecipientLogs)
          .set({ clickedAt: new Date() })
          .where(
            and(
              eq(newsletterRecipientLogs.sendId, sendIdNum),
              eq(newsletterRecipientLogs.subscriberId, subIdNum),
              isNull(newsletterRecipientLogs.clickedAt)
            )
          );

        // If we updated a row (first click), increment the send's click count
        if (result.rowCount && result.rowCount > 0) {
          await db
            .update(newsletterSends)
            .set({
              clickCount: sql`${newsletterSends.clickCount} + 1`,
            })
            .where(eq(newsletterSends.id, sendIdNum));
        }
      } catch (error) {
        // Log but don't fail - tracking should be silent
        console.error("Click tracking error:", error);
      }
    }
  }

  // Redirect to destination
  return NextResponse.redirect(redirectUrl);
}
