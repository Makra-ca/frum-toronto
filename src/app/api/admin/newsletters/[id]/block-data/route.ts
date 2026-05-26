import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import {
  askTheRabbi,
  events,
  simchas,
  simchaTypes,
  blogPosts,
  tehillimList,
  businessShoutouts,
  businesses,
  newsletters,
} from "@/lib/db/schema";
import { eq, and, gte, lte, sql, desc, asc, inArray } from "drizzle-orm";
import { HDate, OmerEvent, HebrewCalendar, flags } from "@hebcal/core";

export const dynamic = "force-dynamic";

type BlockType =
  | "omer"
  | "shoutout"
  | "atr"
  | "events"
  | "simchas"
  | "blogs"
  | "tehillim";

// ─── Omer ────────────────────────────────────────────────────────────────────

function getOmerData(): {
  isOmer: boolean;
  day: number | null;
  hebrewDay: string | null;
  formula: string | null;
} {
  try {
    const today = new HDate();
    const events = HebrewCalendar.calendar({
      start: today,
      end: today,
      omer: true,
      noHolidays: true,
    });

    const omerEvent = events.find((e) => e.getFlags() & flags.OMER_COUNT);
    if (!omerEvent || !(omerEvent instanceof OmerEvent)) {
      return { isOmer: false, day: null, hebrewDay: null, formula: null };
    }

    const omer = omerEvent as OmerEvent;
    const day = omer.omer;
    const hebrewDay = omerEvent.render("en") || `Day ${day}`;
    const formula = omer.getTodayIs("en") || "";

    return { isOmer: true, day, hebrewDay, formula };
  } catch {
    return { isOmer: false, day: null, hebrewDay: null, formula: null };
  }
}

// ─── Shoutout ─────────────────────────────────────────────────────────────────

async function getShoutoutData(newsletterId: number) {
  try {
    // Get the newsletter's send date (or today as fallback)
    const [newsletter] = await db
      .select({ scheduledAt: newsletters.scheduledAt })
      .from(newsletters)
      .where(eq(newsletters.id, newsletterId))
      .limit(1);

    const sendDate = newsletter?.scheduledAt
      ? newsletter.scheduledAt.toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    const rows = await db
      .select({
        id: businessShoutouts.id,
        businessId: businessShoutouts.businessId,
        contentHtml: businessShoutouts.contentHtml,
        imageUrl: businessShoutouts.imageUrl,
        businessName: businesses.name,
        businessSlug: businesses.slug,
        bannerImageUrl: businesses.bannerImageUrl,
        tagline: businesses.tagline,
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

    return rows[0] ?? null;
  } catch (err) {
    // businessShoutouts table may not exist yet — treat as empty
    console.warn("[BLOCK-DATA] shoutout query failed (table may not exist):", err);
    return null;
  }
}

// ─── Ask the Rabbi ───────────────────────────────────────────────────────────

async function getAtrData() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const rows = await db
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

  return rows;
}

// ─── Events ──────────────────────────────────────────────────────────────────

async function getEventsData() {
  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const rows = await db
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

  return rows;
}

// ─── Simchas ─────────────────────────────────────────────────────────────────

async function getSimchasData(simchaTypeSlugs?: string[]) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  let typeIds: number[] | null = null;
  if (simchaTypeSlugs && simchaTypeSlugs.length > 0) {
    const types = await db
      .select({ id: simchaTypes.id })
      .from(simchaTypes)
      .where(inArray(simchaTypes.slug, simchaTypeSlugs));
    typeIds = types.map((t) => t.id);
    if (typeIds.length === 0) return [];
  }

  const conditions = [
    eq(simchas.approvalStatus, "approved"),
    gte(simchas.createdAt, sevenDaysAgo),
  ];

  if (typeIds) {
    conditions.push(inArray(simchas.typeId, typeIds));
  }

  const rows = await db
    .select({
      id: simchas.id,
      familyName: simchas.familyName,
      announcement: simchas.announcement,
      eventDate: simchas.eventDate,
      createdAt: simchas.createdAt,
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

// ─── Blog ─────────────────────────────────────────────────────────────────────

async function getBlogsData() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const rows = await db
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

  return rows;
}

// ─── Tehillim ─────────────────────────────────────────────────────────────────

async function getTehillimData() {
  const rows = await db
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

  return rows;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
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

    const { searchParams } = new URL(request.url);
    const blockType = searchParams.get("blockType") as BlockType | null;
    const simchaTypesParam = searchParams.get("simchaTypes");
    const simchaTypeSlugs = simchaTypesParam ? simchaTypesParam.split(",") : undefined;

    if (!blockType) {
      return NextResponse.json({ error: "blockType query param required" }, { status: 400 });
    }

    const validTypes: BlockType[] = ["omer", "shoutout", "atr", "events", "simchas", "blogs", "tehillim"];
    if (!validTypes.includes(blockType)) {
      return NextResponse.json({ error: `Invalid blockType. Must be one of: ${validTypes.join(", ")}` }, { status: 400 });
    }

    let data: unknown = null;
    let isEmpty = false;

    switch (blockType) {
      case "omer": {
        data = getOmerData();
        isEmpty = !(data as { isOmer: boolean }).isOmer;
        break;
      }
      case "shoutout": {
        data = await getShoutoutData(newsletterId);
        isEmpty = data === null;
        break;
      }
      case "atr": {
        data = await getAtrData();
        isEmpty = (data as unknown[]).length === 0;
        break;
      }
      case "events": {
        data = await getEventsData();
        isEmpty = (data as unknown[]).length === 0;
        break;
      }
      case "simchas": {
        data = await getSimchasData(simchaTypeSlugs);
        isEmpty = (data as unknown[]).length === 0;
        break;
      }
      case "blogs": {
        data = await getBlogsData();
        isEmpty = (data as unknown[]).length === 0;
        break;
      }
      case "tehillim": {
        data = await getTehillimData();
        isEmpty = (data as unknown[]).length === 0;
        break;
      }
    }

    return NextResponse.json({ blockType, data, isEmpty });
  } catch (error) {
    console.error("[BLOCK-DATA] Error fetching block data:", error);
    return NextResponse.json({ error: "Failed to fetch block data" }, { status: 500 });
  }
}
