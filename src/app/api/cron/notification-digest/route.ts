import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  events,
  simchas,
  classifieds,
  tehillimList,
  blogPosts,
  blogComments,
  askTheRabbiComments,
  specials,
  alerts,
  businesses,
  formEmailRecipients,
} from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { resend, EMAIL_FROM } from "@/lib/email/resend";
import { getDailyDigestEmailHtml } from "@/lib/email/templates";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// GET — daily digest of pending Tier B approvals (called by Vercel cron at 13:00 UTC = 8 AM EST)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const count = sql<number>`count(*)`;

    // One cheap count(*) per Tier B type. WHERE clauses match each table's
    // conventions (approvalStatus 'pending' + isActive true; business videos
    // mirror the admin video-review queue: videoStatus 'ready' + pending).
    const [
      [eventsCount],
      [simchasCount],
      [classifiedsCount],
      [tehillimCount],
      [blogPostsCount],
      [blogCommentsCount],
      [atrCommentsCount],
      [specialsCount],
      [alertsCount],
      [videosCount],
    ] = await Promise.all([
      db.select({ count }).from(events)
        .where(and(eq(events.approvalStatus, "pending"), eq(events.isActive, true))),
      db.select({ count }).from(simchas)
        .where(and(eq(simchas.approvalStatus, "pending"), eq(simchas.isActive, true))),
      db.select({ count }).from(classifieds)
        .where(and(eq(classifieds.approvalStatus, "pending"), eq(classifieds.isActive, true))),
      db.select({ count }).from(tehillimList)
        .where(and(eq(tehillimList.approvalStatus, "pending"), eq(tehillimList.isActive, true))),
      db.select({ count }).from(blogPosts)
        .where(and(eq(blogPosts.approvalStatus, "pending"), eq(blogPosts.isActive, true))),
      db.select({ count }).from(blogComments)
        .where(and(eq(blogComments.approvalStatus, "pending"), eq(blogComments.isActive, true))),
      db.select({ count }).from(askTheRabbiComments)
        .where(and(eq(askTheRabbiComments.approvalStatus, "pending"), eq(askTheRabbiComments.isActive, true))),
      db.select({ count }).from(specials)
        .where(and(eq(specials.approvalStatus, "pending"), eq(specials.isActive, true))),
      db.select({ count }).from(alerts)
        .where(and(eq(alerts.approvalStatus, "pending"), eq(alerts.isActive, true))),
      db.select({ count }).from(businesses)
        .where(and(eq(businesses.videoStatus, "ready"), eq(businesses.videoApprovalStatus, "pending"))),
    ]);

    const categories = [
      { label: "Events", count: Number(eventsCount?.count || 0), path: "/admin/programs/events" },
      { label: "Simchas", count: Number(simchasCount?.count || 0), path: "/admin/community/simchas" },
      { label: "Classifieds", count: Number(classifiedsCount?.count || 0), path: "/admin/programs/classifieds" },
      { label: "Tehillim names", count: Number(tehillimCount?.count || 0), path: "/admin/community/tehillim" },
      { label: "Blog posts", count: Number(blogPostsCount?.count || 0), path: "/admin/programs/blog" },
      { label: "Blog comments", count: Number(blogCommentsCount?.count || 0), path: "/admin/programs/blog/comments" },
      { label: "Ask the Rabbi comments", count: Number(atrCommentsCount?.count || 0), path: "/admin/programs/rabbi/comments" },
      { label: "Specials", count: Number(specialsCount?.count || 0), path: "/admin/programs/specials" },
      { label: "Community alerts", count: Number(alertsCount?.count || 0), path: "/admin/community/alerts" },
      { label: "Business videos", count: Number(videosCount?.count || 0), path: "/admin/businesses/video-review" },
    ];

    const nonZero = categories.filter((c) => c.count > 0);
    const totalCount = nonZero.reduce((sum, c) => sum + c.count, 0);

    // Zero pending → no email
    if (totalCount === 0) {
      console.log("[CRON] Notification digest: nothing pending — no email sent");
      return NextResponse.json({ message: "Nothing pending — no digest sent", totalCount: 0 });
    }

    // Recipients configured under the daily_digest form type
    const recipients = await db
      .select({ email: formEmailRecipients.email })
      .from(formEmailRecipients)
      .where(
        and(
          eq(formEmailRecipients.formType, "daily_digest"),
          eq(formEmailRecipients.isActive, true)
        )
      );

    if (recipients.length === 0) {
      console.log("[CRON] Notification digest: no daily_digest recipients configured");
      return NextResponse.json({
        message: "No daily_digest recipients configured — no email sent",
        totalCount,
      });
    }

    if (!resend) {
      console.error("[CRON] Notification digest: Resend not initialized");
      return NextResponse.json({ error: "Resend not initialized" }, { status: 500 });
    }

    const summary = nonZero
      .map((c) => `${c.count} ${c.label.toLowerCase()}`)
      .join(", ");

    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: recipients.map((r) => r.email),
      subject: `${totalCount} item${totalCount === 1 ? "" : "s"} awaiting review: ${summary}`,
      html: getDailyDigestEmailHtml({
        totalCount,
        items: nonZero.map((c) => ({
          label: c.label,
          count: c.count,
          linkUrl: `${APP_URL}${c.path}`,
        })),
      }),
    });

    if (error) {
      console.error("[CRON] Notification digest: failed to send email:", error);
      return NextResponse.json({ error: "Failed to send digest email" }, { status: 500 });
    }

    console.log(`[CRON] Notification digest sent: ${totalCount} pending (${summary})`);
    return NextResponse.json({ message: "Digest sent", totalCount, summary });
  } catch (error) {
    console.error("[CRON] Error generating notification digest:", error);
    return NextResponse.json({ error: "Digest failed" }, { status: 500 });
  }
}
