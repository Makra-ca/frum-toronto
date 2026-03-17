import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import {
  newsletters,
  newsletterSends,
  newsletterRecipientLogs,
  newsletterSegments,
  emailSubscribers,
} from "@/lib/db/schema";
import { eq, and, sql, isNotNull, inArray } from "drizzle-orm";
import type { FilterCriteria } from "@/types/newsletter";
import { resend, EMAIL_FROM } from "@/lib/email/resend";
import { getNewsletterEmailHtml, getNewsletterPlainText } from "@/lib/email/newsletter-template";

const BATCH_SIZE = 100; // Resend limit per batch request
const DELAY_BETWEEN_BATCHES = 600; // ms - to stay under rate limits

// POST - Initiate newsletter send
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
      return NextResponse.json(
        { error: "Invalid newsletter ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { segmentId, scheduleAt } = body;

    // Get newsletter
    const [newsletter] = await db
      .select()
      .from(newsletters)
      .where(eq(newsletters.id, newsletterId))
      .limit(1);

    if (!newsletter) {
      return NextResponse.json(
        { error: "Newsletter not found" },
        { status: 404 }
      );
    }

    if (newsletter.status === "sent" || newsletter.status === "sending") {
      return NextResponse.json(
        { error: "Newsletter has already been sent or is being sent" },
        { status: 400 }
      );
    }

    // Get filter criteria if segment is specified
    let filterCriteria: FilterCriteria | null = null;
    if (segmentId) {
      const [segment] = await db
        .select()
        .from(newsletterSegments)
        .where(eq(newsletterSegments.id, segmentId))
        .limit(1);

      if (segment) {
        filterCriteria = segment.filterCriteria as FilterCriteria | null;
      }
    }

    // Build subscriber query based on filter criteria
    // Only send to registered users (those with userId linked)
    const conditions = [
      eq(emailSubscribers.isActive, true),
      sql`${emailSubscribers.unsubscribedAt} IS NULL`,
      isNotNull(emailSubscribers.userId),
    ];

    // Apply segment filters
    if (filterCriteria) {
      if (filterCriteria.newsletter !== undefined) {
        conditions.push(eq(emailSubscribers.newsletter, filterCriteria.newsletter));
      }
      if (filterCriteria.kosherAlerts !== undefined) {
        conditions.push(eq(emailSubscribers.kosherAlerts, filterCriteria.kosherAlerts));
      }
      if (filterCriteria.eruvStatus !== undefined) {
        conditions.push(eq(emailSubscribers.eruvStatus, filterCriteria.eruvStatus));
      }
      if (filterCriteria.simchas !== undefined) {
        conditions.push(eq(emailSubscribers.simchas, filterCriteria.simchas));
      }
      if (filterCriteria.shiva !== undefined) {
        conditions.push(eq(emailSubscribers.shiva, filterCriteria.shiva));
      }
      if (filterCriteria.tehillim !== undefined) {
        conditions.push(eq(emailSubscribers.tehillim, filterCriteria.tehillim));
      }
      if (filterCriteria.communityEvents !== undefined) {
        conditions.push(eq(emailSubscribers.communityEvents, filterCriteria.communityEvents));
      }
    } else {
      // Default: only send to newsletter subscribers
      conditions.push(eq(emailSubscribers.newsletter, true));
    }

    // Get subscribers
    const subscribers = await db
      .select({
        id: emailSubscribers.id,
        email: emailSubscribers.email,
      })
      .from(emailSubscribers)
      .where(and(...conditions));

    if (subscribers.length === 0) {
      return NextResponse.json(
        { error: "No subscribers match the criteria" },
        { status: 400 }
      );
    }

    // Handle scheduling
    const isScheduled = scheduleAt && new Date(scheduleAt) > new Date();

    // Create newsletter send record
    const [send] = await db
      .insert(newsletterSends)
      .values({
        newsletterId,
        segmentId: segmentId || null,
        totalRecipients: subscribers.length,
        status: isScheduled ? "pending" : "pending",
        startedAt: isScheduled ? null : new Date(),
      })
      .returning();

    // Create recipient logs for each subscriber
    const recipientLogs = subscribers.map((subscriber) => ({
      sendId: send.id,
      subscriberId: subscriber.id,
      email: subscriber.email,
      status: "pending" as const,
    }));

    // Insert in batches to avoid hitting limits
    const batchSize = 1000;
    for (let i = 0; i < recipientLogs.length; i += batchSize) {
      const batch = recipientLogs.slice(i, i + batchSize);
      await db.insert(newsletterRecipientLogs).values(batch);
    }

    // Update newsletter status
    await db
      .update(newsletters)
      .set({
        status: isScheduled ? "scheduled" : "sending",
        scheduledAt: isScheduled ? new Date(scheduleAt) : null,
        updatedAt: new Date(),
      })
      .where(eq(newsletters.id, newsletterId));

    // If scheduled for later, just return — a cron or separate trigger will handle it
    if (isScheduled) {
      return NextResponse.json({
        success: true,
        sendId: send.id,
        totalRecipients: subscribers.length,
        status: "scheduled",
        scheduledAt: scheduleAt,
      });
    }

    // Send all emails immediately (Vercel Pro: 60s timeout handles ~7,000 recipients)
    if (!resend) {
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      );
    }

    // Get all pending recipient logs with subscriber data
    const pendingLogs = await db
      .select({
        log: newsletterRecipientLogs,
        subscriber: emailSubscribers,
      })
      .from(newsletterRecipientLogs)
      .innerJoin(emailSubscribers, eq(newsletterRecipientLogs.subscriberId, emailSubscribers.id))
      .where(
        and(
          eq(newsletterRecipientLogs.sendId, send.id),
          eq(newsletterRecipientLogs.status, "pending")
        )
      );

    let totalSent = 0;
    let totalFailed = 0;

    // Process in batches of 100 (Resend batch limit)
    for (let i = 0; i < pendingLogs.length; i += BATCH_SIZE) {
      const batch = pendingLogs.slice(i, i + BATCH_SIZE);

      const emails = batch.map(({ log, subscriber }) => ({
        from: EMAIL_FROM,
        to: log.email,
        subject: newsletter.subject,
        html: getNewsletterEmailHtml({
          content: newsletter.content,
          previewText: newsletter.previewText || undefined,
          sendId: send.id,
          subscriberId: subscriber.id,
          unsubscribeToken: subscriber.unsubscribeToken || "",
          trackOpens: true,
        }),
        text: getNewsletterPlainText(newsletter.content, subscriber.unsubscribeToken || ""),
      }));

      try {
        const { data, error } = await resend.batch.send(emails);

        if (error) {
          console.error("[NEWSLETTER] Batch send error:", error);
          const logIds = batch.map((b) => b.log.id);
          await db
            .update(newsletterRecipientLogs)
            .set({
              status: "failed",
              errorMessage: error.message || "Batch send failed",
            })
            .where(inArray(newsletterRecipientLogs.id, logIds));
          totalFailed += batch.length;
        } else if (data) {
          for (let j = 0; j < batch.length; j++) {
            const result = data.data[j];
            const { log } = batch[j];

            if (result && result.id) {
              await db
                .update(newsletterRecipientLogs)
                .set({
                  status: "sent",
                  resendMessageId: result.id,
                  sentAt: new Date(),
                })
                .where(eq(newsletterRecipientLogs.id, log.id));
              totalSent++;
            } else {
              await db
                .update(newsletterRecipientLogs)
                .set({
                  status: "failed",
                  errorMessage: "No message ID returned",
                })
                .where(eq(newsletterRecipientLogs.id, log.id));
              totalFailed++;
            }
          }
        }
      } catch (batchError) {
        console.error("[NEWSLETTER] Batch processing error:", batchError);
        const logIds = batch.map((b) => b.log.id);
        await db
          .update(newsletterRecipientLogs)
          .set({
            status: "failed",
            errorMessage: batchError instanceof Error ? batchError.message : "Unknown error",
          })
          .where(inArray(newsletterRecipientLogs.id, logIds));
        totalFailed += batch.length;
      }

      // Update running counts
      await db
        .update(newsletterSends)
        .set({
          sentCount: totalSent,
          failedCount: totalFailed,
        })
        .where(eq(newsletterSends.id, send.id));

      // Delay between batches to stay under Resend rate limits
      if (i + BATCH_SIZE < pendingLogs.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    // Mark send as completed
    await db
      .update(newsletterSends)
      .set({
        status: "completed",
        completedAt: new Date(),
        sentCount: totalSent,
        failedCount: totalFailed,
      })
      .where(eq(newsletterSends.id, send.id));

    // Update newsletter status to sent
    await db
      .update(newsletters)
      .set({
        status: "sent",
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(newsletters.id, newsletterId));

    return NextResponse.json({
      success: true,
      sendId: send.id,
      totalRecipients: subscribers.length,
      sent: totalSent,
      failed: totalFailed,
      status: "completed",
    });
  } catch (error) {
    console.error("[NEWSLETTER] Error sending newsletter:", error);
    return NextResponse.json(
      { error: "Failed to send newsletter" },
      { status: 500 }
    );
  }
}
