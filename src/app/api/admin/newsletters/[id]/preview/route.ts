import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import {
  newsletters,
  newsletterBlockSettings,
  askTheRabbi,
  events,
  simchas,
  simchaTypes,
  blogPosts,
  tehillimList,
  businessShoutouts,
  businesses,
  shivaNotifications,
} from "@/lib/db/schema";
import { eq, and, gte, lte, desc, asc, inArray, sql } from "drizzle-orm";
import { HDate, OmerEvent, HebrewCalendar, flags } from "@hebcal/core";
import {
  renderNewsletterHTML,
  type OmerData,
  type BusinessShoutoutData,
  type AtrQuestion,
  type EventData,
  type SimchaData,
  type ShivaData,
  type BlogPostData,
  type TehillimEntry,
} from "@/lib/email/newsletter-renderer";

export const dynamic = "force-dynamic";

// ─── Data fetchers (same logic as block-data route) ──────────────────────────

function getOmerData(): OmerData | null {
  try {
    const today = new HDate();
    const calEvents = HebrewCalendar.calendar({
      start: today,
      end: today,
      omer: true,
      noHolidays: true,
    });

    const omerEvent = calEvents.find((e) => e.getFlags() & flags.OMER_COUNT);
    if (!omerEvent || !(omerEvent instanceof OmerEvent)) return null;

    const omer = omerEvent as OmerEvent;
    return {
      day: omer.omer,
      hebrewDay: omerEvent.render("en") || `Day ${omer.omer}`,
      formula: omer.getTodayIs("en") || "",
    };
  } catch {
    return null;
  }
}

async function getShoutoutData(
  sendDate: string
): Promise<BusinessShoutoutData | null> {
  try {
    const rows = await db
      .select({
        businessName: businesses.name,
        businessSlug: businesses.slug,
        bannerImageUrl: businesses.bannerImageUrl,
        tagline: businesses.tagline,
        contentHtml: businessShoutouts.contentHtml,
      })
      .from(businessShoutouts)
      .innerJoin(businesses, eq(businessShoutouts.businessId, businesses.id))
      .where(
        and(
          eq(businessShoutouts.status, "approved"),
          sql`${businessShoutouts.scheduledDate}::text = ${sendDate}`
        )
      )
      .limit(1);

    if (!rows[0]) return null;
    return rows[0] as BusinessShoutoutData;
  } catch {
    return null;
  }
}

async function getAtrData(): Promise<AtrQuestion[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return db
    .select({
      id: askTheRabbi.id,
      questionNumber: askTheRabbi.questionNumber,
      title: askTheRabbi.title,
      question: askTheRabbi.question,
      answer: askTheRabbi.answer,
      publishedAt: askTheRabbi.publishedAt,
    })
    .from(askTheRabbi)
    .where(
      and(
        eq(askTheRabbi.isPublished, true),
        gte(askTheRabbi.publishedAt, sevenDaysAgo)
      )
    )
    .orderBy(desc(askTheRabbi.publishedAt))
    .limit(10);
}

async function getEventsData(): Promise<EventData[]> {
  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  return db
    .select({
      id: events.id,
      title: events.title,
      startTime: events.startTime,
      endTime: events.endTime,
      location: events.location,
      description: events.description,
      eventType: events.eventType,
    })
    .from(events)
    .where(
      and(
        eq(events.approvalStatus, "approved"),
        eq(events.isActive, true),
        gte(events.startTime, now),
        lte(events.startTime, sevenDaysFromNow)
      )
    )
    .orderBy(asc(events.startTime))
    .limit(5);
}

async function getShivaData(): Promise<ShivaData[]> {
  const today = new Date().toISOString().split("T")[0];
  return db
    .select({
      id: shivaNotifications.id,
      niftarName: shivaNotifications.niftarName,
      niftarNameHebrew: shivaNotifications.niftarNameHebrew,
      mournerNames: shivaNotifications.mournerNames,
      shivaAddress: shivaNotifications.shivaAddress,
      shivaStart: shivaNotifications.shivaStart,
      shivaEnd: shivaNotifications.shivaEnd,
      shivaHours: shivaNotifications.shivaHours,
      daveningTimes: shivaNotifications.daveningTimes,
    })
    .from(shivaNotifications)
    .where(
      and(
        eq(shivaNotifications.approvalStatus, "approved"),
        gte(shivaNotifications.shivaEnd, today)
      )
    )
    .orderBy(asc(shivaNotifications.shivaEnd))
    .limit(10) as Promise<ShivaData[]>;
}

async function getSimchasData(typeSlugs?: string[]): Promise<SimchaData[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const conditions = [
    eq(simchas.approvalStatus, "approved"),
    gte(simchas.createdAt, sevenDaysAgo),
  ];

  if (typeSlugs && typeSlugs.length > 0) {
    const types = await db
      .select({ id: simchaTypes.id })
      .from(simchaTypes)
      .where(inArray(simchaTypes.slug, typeSlugs));
    const ids = types.map((t) => t.id);
    if (ids.length === 0) return [];
    conditions.push(inArray(simchas.typeId, ids));
  }

  const rows = await db
    .select({
      id: simchas.id,
      familyName: simchas.familyName,
      announcement: simchas.announcement,
      eventDate: simchas.eventDate,
      typeName: simchaTypes.name,
      typeSlug: simchaTypes.slug,
    })
    .from(simchas)
    .innerJoin(simchaTypes, eq(simchas.typeId, simchaTypes.id))
    .where(and(...conditions))
    .orderBy(desc(simchas.createdAt))
    .limit(10);

  return rows;
}

async function getBlogsData(): Promise<BlogPostData[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return db
    .select({
      id: blogPosts.id,
      title: blogPosts.title,
      slug: blogPosts.slug,
      excerpt: blogPosts.excerpt,
      coverImageUrl: blogPosts.coverImageUrl,
      publishedAt: blogPosts.publishedAt,
    })
    .from(blogPosts)
    .where(
      and(
        eq(blogPosts.approvalStatus, "approved"),
        eq(blogPosts.isActive, true),
        sql`${blogPosts.publishedAt} IS NOT NULL`,
        gte(blogPosts.publishedAt, sevenDaysAgo)
      )
    )
    .orderBy(desc(blogPosts.publishedAt))
    .limit(3);
}

async function getTehillimData(): Promise<TehillimEntry[]> {
  return db
    .select({
      id: tehillimList.id,
      hebrewName: tehillimList.hebrewName,
      englishName: tehillimList.englishName,
      motherHebrewName: tehillimList.motherHebrewName,
    })
    .from(tehillimList)
    .where(
      and(
        eq(tehillimList.isActive, true),
        eq(tehillimList.approvalStatus, "approved")
      )
    )
    .orderBy(asc(tehillimList.createdAt))
    .limit(50);
}

// ─── POST handler ─────────────────────────────────────────────────────────────

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

    // Fetch newsletter
    const [newsletter] = await db
      .select()
      .from(newsletters)
      .where(eq(newsletters.id, newsletterId))
      .limit(1);

    if (!newsletter) {
      return NextResponse.json({ error: "Newsletter not found" }, { status: 404 });
    }

    // Read block settings from DB (already saved by auto-save) or accept from body
    const body = await request.json().catch(() => ({}));
    const bodyBlockSettings: Record<string, unknown> = body.blockSettings || {};

    // Merge DB settings with body (body takes precedence for live toggles)
    const dbSettings = await db
      .select()
      .from(newsletterBlockSettings)
      .where(eq(newsletterBlockSettings.newsletterId, newsletterId));

    const settingsMap: Record<string, { isEnabled: boolean; config: unknown }> = {};
    for (const row of dbSettings) {
      settingsMap[row.blockType] = { isEnabled: row.isEnabled, config: row.config };
    }

    // Override with anything explicitly sent in the body
    for (const [blockType, val] of Object.entries(bodyBlockSettings)) {
      if (typeof val === "boolean") {
        settingsMap[blockType] = { isEnabled: val, config: settingsMap[blockType]?.config };
      } else if (val && typeof val === "object") {
        const v = val as { enabled?: boolean; types?: string[] };
        settingsMap[blockType] = {
          isEnabled: v.enabled ?? settingsMap[blockType]?.isEnabled ?? false,
          config: v.types ? { simchaTypes: v.types } : settingsMap[blockType]?.config,
        };
      }
    }

    const isEnabled = (t: string) => settingsMap[t]?.isEnabled === true;

    // Determine send date for shoutout lookup (today = preview date)
    const sendDate = new Date().toISOString().split("T")[0];

    // Fetch data for all enabled blocks in parallel
    const [omerData, shoutoutData, atrData, eventsData, simchasData, shivaData, blogsData, tehillimData] =
      await Promise.all([
        isEnabled("omer") ? Promise.resolve(getOmerData()) : Promise.resolve(null),
        isEnabled("shoutout") ? getShoutoutData(sendDate) : Promise.resolve(null),
        isEnabled("atr") ? getAtrData() : Promise.resolve([]),
        isEnabled("events") ? getEventsData() : Promise.resolve([]),
        isEnabled("simchas")
          ? getSimchasData(
              (settingsMap["simchas"]?.config as { simchaTypes?: string[] })?.simchaTypes
            )
          : Promise.resolve([]),
        isEnabled("shiva") ? getShivaData() : Promise.resolve([]),
        isEnabled("blogs") ? getBlogsData() : Promise.resolve([]),
        isEnabled("tehillim") ? getTehillimData() : Promise.resolve([]),
      ]);

    const blocksIncluded: string[] = [];
    const blocksSkipped: string[] = [];

    if (isEnabled("omer")) {
      if (omerData) blocksIncluded.push("omer");
      else blocksSkipped.push("omer");
    }
    if (isEnabled("shoutout")) {
      if (shoutoutData) blocksIncluded.push("shoutout");
      else blocksSkipped.push("shoutout");
    }
    if (isEnabled("atr")) {
      if (atrData.length > 0) blocksIncluded.push("atr");
      else blocksSkipped.push("atr");
    }
    if (isEnabled("events")) {
      if (eventsData.length > 0) blocksIncluded.push("events");
      else blocksSkipped.push("events");
    }
    if (isEnabled("simchas")) {
      if (simchasData.length > 0) blocksIncluded.push("simchas");
      else blocksSkipped.push("simchas");
    }
    if (isEnabled("shiva")) {
      if (shivaData.length > 0) blocksIncluded.push("shiva");
      else blocksSkipped.push("shiva");
    }
    if (isEnabled("blogs")) {
      if (blogsData.length > 0) blocksIncluded.push("blogs");
      else blocksSkipped.push("blogs");
    }
    if (isEnabled("tehillim")) {
      if (tehillimData.length > 0) blocksIncluded.push("tehillim");
      else blocksSkipped.push("tehillim");
    }

    // Render full HTML — use a placeholder token/email since this is for preview
    const previewHtml = renderNewsletterHTML({
      newsletter: {
        title: newsletter.title,
        subject: newsletter.subject,
        content: newsletter.content || "",
        previewText: newsletter.previewText,
      },
      blocks: {
        omer: omerData,
        shoutout: shoutoutData,
        atr: atrData.length > 0 ? atrData : null,
        events: eventsData.length > 0 ? eventsData : null,
        simchas: simchasData.length > 0 ? simchasData : null,
        shiva: shivaData.length > 0 ? shivaData : null,
        blog: blogsData.length > 0 ? blogsData : null,
        tehillim: tehillimData.length > 0 ? tehillimData : null,
      },
      recipientEmail: "preview@frumtoronto.com",
      unsubscribeToken: "PREVIEW_TOKEN",
      trackOpens: false,
    });

    const generatedAt = new Date();

    // Persist preview HTML to newsletters table
    await db
      .update(newsletters)
      .set({
        previewHtml,
        previewGeneratedAt: generatedAt,
        updatedAt: new Date(),
      })
      .where(eq(newsletters.id, newsletterId));

    return NextResponse.json({
      previewHtml,
      previewGeneratedAt: generatedAt.toISOString(),
      blocksIncluded,
      blocksSkipped,
    });
  } catch (error) {
    console.error("[PREVIEW] Error generating preview:", error);
    return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
  }
}
