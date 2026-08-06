import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsletterRecipientLogs, newsletterSends } from "@/lib/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import { isValidClickSignature } from "@/lib/newsletter/click-signature";

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
  const signature = searchParams.get("sig");

  // Validate destination URL
  if (!destinationUrl) {
    return NextResponse.redirect(APP_URL);
  }

  // This endpoint used to redirect anywhere `new URL()` could parse, which made
  // frumtoronto.com a laundering host for phishing links aimed at a list
  // trained to click them. The destination must now carry an HMAC minted at
  // send time. Unsigned or altered links go home instead — no newsletter has
  // ever been sent, so there are no pre-signature links in anyone's inbox.
  if (!isValidClickSignature(destinationUrl, signature)) {
    console.warn("[NEWSLETTER] Rejected unsigned click destination:", destinationUrl);
    return NextResponse.redirect(APP_URL);
  }

  // Note: no second decodeURIComponent. URLSearchParams has already undone the
  // encodeURIComponent applied at send time, so decoding again corrupted any
  // destination containing a literal percent (".../?q=50%25" became ".../?q=50%").
  // It also has to match, byte for byte, the string the signature covers.
  //
  // Resolved against APP_URL rather than parsed standalone, because a
  // newsletter block may legitimately emit a root-relative href ("/blog/x").
  // Resolving sends that to our own site; parsing it standalone would throw,
  // and prefixing "https://" would read "blog" as the hostname.
  let redirectUrl: string;
  try {
    const parsed = new URL(destinationUrl, APP_URL);
    // Signed but not http/https — belt and braces against a future caller
    // signing something it should not have.
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.redirect(APP_URL);
    }
    redirectUrl = parsed.toString();
  } catch {
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
