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
import { eq, and, sql, isNotNull } from "drizzle-orm";
import type { FilterCriteria } from "@/types/newsletter";

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

    return NextResponse.json({
      success: true,
      sendId: send.id,
      totalRecipients: subscribers.length,
      status: isScheduled ? "scheduled" : "sending",
      scheduledAt: isScheduled ? scheduleAt : null,
    });
  } catch (error) {
    console.error("Error initiating newsletter send:", error);
    return NextResponse.json(
      { error: "Failed to initiate newsletter send" },
      { status: 500 }
    );
  }
}
