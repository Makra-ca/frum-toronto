import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsletterSends, newsletterRecipientLogs, newsletters, emailSubscribers } from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { resend, EMAIL_FROM } from "@/lib/email/resend";
import { getNewsletterEmailHtml, getNewsletterPlainText } from "@/lib/email/newsletter-template";

const BATCH_SIZE = 100; // Resend limit per batch request
const BATCHES_PER_RUN = 5; // Process 500 emails per cron run
const DELAY_BETWEEN_BATCHES = 600; // ms - to stay under rate limits

/**
 * Cron job to process pending newsletter sends
 * This should run every minute via Vercel cron
 */
export async function GET(req: NextRequest) {
  // Verify cron secret for security
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!resend) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
  }

  try {
    // Find sends that are "processing" or "pending"
    const activeSends = await db
      .select({
        send: newsletterSends,
        newsletter: newsletters,
      })
      .from(newsletterSends)
      .innerJoin(newsletters, eq(newsletterSends.newsletterId, newsletters.id))
      .where(
        sql`${newsletterSends.status} IN ('pending', 'processing')`
      )
      .limit(1);

    if (activeSends.length === 0) {
      return NextResponse.json({ message: "No pending sends" });
    }

    const { send, newsletter } = activeSends[0];

    // Mark as processing if still pending
    if (send.status === "pending") {
      await db
        .update(newsletterSends)
        .set({
          status: "processing",
          startedAt: new Date(),
        })
        .where(eq(newsletterSends.id, send.id));
    }

    // Get pending recipient logs
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
      )
      .limit(BATCH_SIZE * BATCHES_PER_RUN);

    if (pendingLogs.length === 0) {
      // All done, mark as completed
      await db
        .update(newsletterSends)
        .set({
          status: "completed",
          completedAt: new Date(),
        })
        .where(eq(newsletterSends.id, send.id));

      // Update newsletter status
      await db
        .update(newsletters)
        .set({
          status: "sent",
          sentAt: new Date(),
        })
        .where(eq(newsletters.id, newsletter.id));

      return NextResponse.json({
        message: "Send completed",
        sendId: send.id,
        totalSent: send.sentCount,
      });
    }

    // Process in batches
    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < pendingLogs.length; i += BATCH_SIZE) {
      const batch = pendingLogs.slice(i, i + BATCH_SIZE);

      // Prepare emails for batch sending
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
        // Send batch
        const { data, error } = await resend.batch.send(emails);

        if (error) {
          console.error("Batch send error:", error);
          // Mark all in batch as failed
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
          // Update individual logs with results
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
        console.error("Batch processing error:", batchError);
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

      // Update send counts
      await db
        .update(newsletterSends)
        .set({
          sentCount: sql`${newsletterSends.sentCount} + ${totalSent}`,
          failedCount: sql`${newsletterSends.failedCount} + ${totalFailed}`,
        })
        .where(eq(newsletterSends.id, send.id));

      // Delay between batches to stay under rate limits
      if (i + BATCH_SIZE < pendingLogs.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    return NextResponse.json({
      message: "Batch processed",
      sendId: send.id,
      processed: pendingLogs.length,
      sent: totalSent,
      failed: totalFailed,
    });
  } catch (error) {
    console.error("Newsletter cron error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process" },
      { status: 500 }
    );
  }
}
