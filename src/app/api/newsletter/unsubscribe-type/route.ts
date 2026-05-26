import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailSubscribers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Allowlist of valid preference column names — never pass raw user input to DB
const ALLOWED_TYPES: Record<string, keyof typeof emailSubscribers.$inferSelect> = {
  newsletter: "newsletter",
  kosherAlerts: "kosherAlerts",
  simchas: "simchas",
  shiva: "shiva",
  tehillim: "tehillim",
  communityEvents: "communityEvents",
  communityAlerts: "communityAlerts",
  eruvStatus: "eruvStatus",
  askTheRabbiAnswered: "askTheRabbiAnswered",
  atrCommentReplies: "atrCommentReplies",
  blogCommentNotifications: "blogCommentNotifications",
  businessDeals: "businessDeals",
};

/**
 * One-click per-type unsubscribe via token link in email footers
 * GET /api/newsletter/unsubscribe-type?token=[token]&type=[typeKey]
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const type = searchParams.get("type");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://frumtoronto.com";

  if (!token || !type) {
    return NextResponse.json({ error: "token and type query params are required" }, { status: 400 });
  }

  // Validate type against allowlist — never pass raw input to DB
  const columnKey = ALLOWED_TYPES[type];
  if (!columnKey) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  try {
    // Find subscriber by token
    const [subscriber] = await db
      .select({ id: emailSubscribers.id })
      .from(emailSubscribers)
      .where(eq(emailSubscribers.unsubscribeToken, token))
      .limit(1);

    if (!subscriber) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    // Set only the requested column to false using the safe column reference
    await db
      .update(emailSubscribers)
      .set({ [columnKey]: false })
      .where(eq(emailSubscribers.id, subscriber.id));

    // Redirect to confirmation page
    return NextResponse.redirect(
      `${baseUrl}/newsletter/unsubscribed?type=${encodeURIComponent(type)}&token=${encodeURIComponent(token)}`
    );
  } catch (error) {
    console.error("[API] Error processing per-type unsubscribe:", error);
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
  }
}
