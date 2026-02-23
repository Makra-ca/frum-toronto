import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsletterRecipientLogs, newsletterSends } from "@/lib/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";

// 1x1 transparent GIF pixel
const TRACKING_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

/**
 * Track newsletter email opens via invisible pixel
 * GET /api/newsletter/track/open?sid=123&sub=456
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sendId = searchParams.get("sid");
  const subscriberId = searchParams.get("sub");

  // Always return pixel, even if params are invalid
  const pixelResponse = new NextResponse(TRACKING_PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });

  // Validate params
  if (!sendId || !subscriberId) {
    return pixelResponse;
  }

  const sendIdNum = parseInt(sendId);
  const subIdNum = parseInt(subscriberId);

  if (isNaN(sendIdNum) || isNaN(subIdNum)) {
    return pixelResponse;
  }

  try {
    // Update recipient log only if not already opened
    await db
      .update(newsletterRecipientLogs)
      .set({ openedAt: new Date() })
      .where(
        and(
          eq(newsletterRecipientLogs.sendId, sendIdNum),
          eq(newsletterRecipientLogs.subscriberId, subIdNum),
          isNull(newsletterRecipientLogs.openedAt)
        )
      );

    // Increment open count on send record
    // Using a subquery to count unique opens would be more accurate,
    // but for performance, we'll increment on first open only
    await db
      .update(newsletterSends)
      .set({
        openCount: sql`${newsletterSends.openCount} + 1`,
      })
      .where(
        and(
          eq(newsletterSends.id, sendIdNum),
          // Only increment if this was a new open (check via CTE or just accept slight inaccuracy)
          sql`EXISTS (
            SELECT 1 FROM newsletter_recipient_logs
            WHERE send_id = ${sendIdNum}
            AND subscriber_id = ${subIdNum}
            AND opened_at = NOW()
          )`
        )
      );
  } catch (error) {
    // Log but don't fail - tracking should be silent
    console.error("Open tracking error:", error);
  }

  return pixelResponse;
}
