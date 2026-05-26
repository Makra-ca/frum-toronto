import { db } from "@/lib/db";
import {
  pageViews,
  searchQueries,
  users,
  businesses,
  events,
  blogPosts,
  classifieds,
  shiurim,
  shivaNotifications,
  simchas,
  tehillimList,
  askTheRabbi,
} from "@/lib/db/schema";
import {
  and,
  eq,
  gte,
  lte,
  count,
  countDistinct,
  sql,
  inArray,
  desc,
} from "drizzle-orm";

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

export async function recordPageView(params: {
  url: string;
  entityType?: string;
  entityId?: number;
  userId?: number;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
}): Promise<void> {
  await db.insert(pageViews).values({
    url: params.url,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
    userId: params.userId ?? null,
    sessionId: params.sessionId ?? "unknown",
    ipAddress: params.ipAddress ?? "unknown",
    userAgent: params.userAgent ?? null,
    referrer: params.referrer ?? null,
  });
}

export async function recordSearchQuery(params: {
  query: string;
  searchType?: string;
  resultsCount: number;
  userId?: number;
  sessionId?: string;
}): Promise<void> {
  await db.insert(searchQueries).values({
    query: params.query,
    searchType: params.searchType ?? "all",
    resultsCount: params.resultsCount,
    userId: params.userId ?? null,
    sessionId: params.sessionId ?? "unknown",
  });
}

// ---------------------------------------------------------------------------
// Date range helpers
// ---------------------------------------------------------------------------

function daysAgoDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

// ---------------------------------------------------------------------------
// Top pages
// ---------------------------------------------------------------------------

export async function getTopPages(params: {
  days: number;
  limit?: number;
}): Promise<{ url: string; views: number; uniqueViews: number }[]> {
  const from = daysAgoDate(params.days);
  const limit = params.limit ?? 20;

  const rows = await db
    .select({
      url: pageViews.url,
      views: count(),
      uniqueViews: countDistinct(pageViews.sessionId),
    })
    .from(pageViews)
    .where(gte(pageViews.viewedAt, from))
    .groupBy(pageViews.url)
    .orderBy(desc(count()))
    .limit(limit);

  return rows.map((r) => ({
    url: r.url,
    views: Number(r.views),
    uniqueViews: Number(r.uniqueViews),
  }));
}

// ---------------------------------------------------------------------------
// User signup trend
// ---------------------------------------------------------------------------

export async function getUserSignupTrend(params: {
  days: number;
}): Promise<{ date: string; count: number }[]> {
  const from = daysAgoDate(params.days);
  const useWeeks = params.days > 45;

  const trunc = useWeeks ? "week" : "day";

  const rows = await db.execute(sql`
    SELECT
      DATE_TRUNC(${trunc}, created_at AT TIME ZONE 'America/Toronto') AS bucket,
      COUNT(*) AS cnt
    FROM users
    WHERE created_at >= ${from}
    GROUP BY 1
    ORDER BY 1
  `);

  return (rows.rows as Array<{ bucket: Date; cnt: string | number }>).map((r) => ({
    date: new Date(r.bucket).toISOString().slice(0, 10),
    count: Number(r.cnt),
  }));
}

// ---------------------------------------------------------------------------
// Top businesses by view count
// ---------------------------------------------------------------------------

export async function getTopBusinesses(params: {
  days: number;
  limit?: number;
}): Promise<{ id: number; name: string; views: number }[]> {
  const from = daysAgoDate(params.days);
  const limit = params.limit ?? 10;

  const rows = await db
    .select({
      entityId: pageViews.entityId,
      views: count(),
    })
    .from(pageViews)
    .where(
      and(
        eq(pageViews.entityType, "business"),
        gte(pageViews.viewedAt, from)
      )
    )
    .groupBy(pageViews.entityId)
    .orderBy(desc(count()))
    .limit(limit);

  const ids = rows.map((r) => r.entityId).filter((id): id is number => id !== null);

  if (ids.length === 0) return [];

  const names = await db
    .select({ id: businesses.id, name: businesses.name })
    .from(businesses)
    .where(inArray(businesses.id, ids));

  const nameMap = new Map(names.map((b) => [b.id, b.name]));

  return rows
    .filter((r) => r.entityId !== null)
    .map((r) => ({
      id: r.entityId as number,
      name: nameMap.get(r.entityId as number) ?? "Unknown",
      views: Number(r.views),
    }));
}

// ---------------------------------------------------------------------------
// Top blog posts by view count
// ---------------------------------------------------------------------------

export async function getTopBlogPosts(params: {
  days: number;
  limit?: number;
}): Promise<{ id: number; title: string; slug: string; views: number }[]> {
  const from = daysAgoDate(params.days);
  const limit = params.limit ?? 10;

  const rows = await db
    .select({
      entityId: pageViews.entityId,
      views: count(),
    })
    .from(pageViews)
    .where(
      and(
        eq(pageViews.entityType, "blog_post"),
        gte(pageViews.viewedAt, from)
      )
    )
    .groupBy(pageViews.entityId)
    .orderBy(desc(count()))
    .limit(limit);

  const ids = rows.map((r) => r.entityId).filter((id): id is number => id !== null);

  if (ids.length === 0) return [];

  const posts = await db
    .select({ id: blogPosts.id, title: blogPosts.title, slug: blogPosts.slug })
    .from(blogPosts)
    .where(inArray(blogPosts.id, ids));

  const postMap = new Map(posts.map((p) => [p.id, p]));

  return rows
    .filter((r) => r.entityId !== null)
    .map((r) => {
      const post = postMap.get(r.entityId as number);
      return {
        id: r.entityId as number,
        title: post?.title ?? "Unknown",
        slug: post?.slug ?? "",
        views: Number(r.views),
      };
    });
}

// ---------------------------------------------------------------------------
// Top search queries
// ---------------------------------------------------------------------------

export async function getTopSearchQueries(params: {
  days: number;
  limit?: number;
}): Promise<{ query: string; count: number; searchType: string }[]> {
  const from = daysAgoDate(params.days);
  const limit = params.limit ?? 20;

  const rows = await db
    .select({
      query: searchQueries.query,
      searchType: searchQueries.searchType,
      count: count(),
    })
    .from(searchQueries)
    .where(gte(searchQueries.searchedAt, from))
    .groupBy(searchQueries.query, searchQueries.searchType)
    .orderBy(desc(count()))
    .limit(limit);

  return rows.map((r) => ({
    query: r.query,
    searchType: r.searchType ?? "all",
    count: Number(r.count),
  }));
}

// ---------------------------------------------------------------------------
// Event views
// ---------------------------------------------------------------------------

export async function getEventViews(params: {
  days: number;
  limit?: number;
}): Promise<{ id: number; title: string; views: number }[]> {
  const from = daysAgoDate(params.days);
  const limit = params.limit ?? 10;

  const rows = await db
    .select({
      entityId: pageViews.entityId,
      views: count(),
    })
    .from(pageViews)
    .where(
      and(
        eq(pageViews.entityType, "event"),
        gte(pageViews.viewedAt, from)
      )
    )
    .groupBy(pageViews.entityId)
    .orderBy(desc(count()))
    .limit(limit);

  const ids = rows.map((r) => r.entityId).filter((id): id is number => id !== null);

  if (ids.length === 0) return [];

  const evts = await db
    .select({ id: events.id, title: events.title })
    .from(events)
    .where(inArray(events.id, ids));

  const eventMap = new Map(evts.map((e) => [e.id, e.title]));

  return rows
    .filter((r) => r.entityId !== null)
    .map((r) => ({
      id: r.entityId as number,
      title: eventMap.get(r.entityId as number) ?? "Unknown",
      views: Number(r.views),
    }));
}

// ---------------------------------------------------------------------------
// Full analytics data bundle (used by admin dashboard page + API)
// ---------------------------------------------------------------------------

export interface OverviewMetrics {
  totalViews: number;
  uniqueVisitors: number;
  newSignups: number;
  prevTotalViews: number;
  prevUniqueVisitors: number;
  prevNewSignups: number;
}

export interface ContentSubmissions {
  businesses: number;
  events: number;
  blogPosts: number;
  classifieds: number;
  shiurim: number;
  shiva: number;
  simchas: number;
  tehillim: number;
  askTheRabbi: number;
}

export interface AnalyticsData {
  overview: OverviewMetrics;
  topPages: { url: string; views: number; uniqueViews: number }[];
  topBusinesses: { id: number; name: string; views: number }[];
  topBlogPosts: { id: number; title: string; slug: string; views: number }[];
  topEvents: { id: number; title: string; views: number }[];
  topSearchQueries: { query: string; count: number; searchType: string }[];
  signupTrend: { date: string; count: number }[];
  contentSubmissions: ContentSubmissions;
}

export async function getAnalyticsData(
  from: Date,
  to: Date
): Promise<AnalyticsData> {
  // Compute previous period of the same length
  const periodMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - periodMs);

  const days = Math.round(periodMs / (1000 * 60 * 60 * 24));

  // ---- Overview (current) ----
  const [currentOverview] = await db
    .select({
      totalViews: count(),
      uniqueVisitors: countDistinct(pageViews.sessionId),
    })
    .from(pageViews)
    .where(and(gte(pageViews.viewedAt, from), lte(pageViews.viewedAt, to)));

  const [prevOverview] = await db
    .select({
      totalViews: count(),
      uniqueVisitors: countDistinct(pageViews.sessionId),
    })
    .from(pageViews)
    .where(and(gte(pageViews.viewedAt, prevFrom), lte(pageViews.viewedAt, prevTo)));

  const [currentSignups] = await db
    .select({ count: count() })
    .from(users)
    .where(and(gte(users.createdAt, from), lte(users.createdAt, to)));

  const [prevSignups] = await db
    .select({ count: count() })
    .from(users)
    .where(and(gte(users.createdAt, prevFrom), lte(users.createdAt, prevTo)));

  // ---- Top entities ----
  const [topPagesResult, topBusinessesResult, topBlogPostsResult, topEventsResult, topSearchQueriesResult] =
    await Promise.all([
      getTopPages({ days, limit: 20 }),
      getTopBusinesses({ days, limit: 10 }),
      getTopBlogPosts({ days, limit: 10 }),
      getEventViews({ days, limit: 10 }),
      getTopSearchQueries({ days, limit: 20 }),
    ]);

  // ---- Signup trend ----
  const signupTrend = await getUserSignupTrend({ days });

  // ---- Content submissions (current + previous period) ----
  const [
    bizCount, eventCount, blogCount, classifiedCount, shiurCount, shivaCount, simchaCount, tehillimCount, rabiCount,
    prevBizCount, prevEventCount, prevBlogCount, prevClassifiedCount, prevShiurCount, prevShivaCount, prevSimchaCount, prevTehillimCount, prevRabiCount,
  ] = await Promise.all([
    db.select({ count: count() }).from(businesses).where(and(gte(businesses.createdAt, from), lte(businesses.createdAt, to))),
    db.select({ count: count() }).from(events).where(and(gte(events.createdAt, from), lte(events.createdAt, to))),
    db.select({ count: count() }).from(blogPosts).where(and(gte(blogPosts.createdAt, from), lte(blogPosts.createdAt, to))),
    db.select({ count: count() }).from(classifieds).where(and(gte(classifieds.createdAt, from), lte(classifieds.createdAt, to))),
    db.select({ count: count() }).from(shiurim).where(and(gte(shiurim.createdAt, from), lte(shiurim.createdAt, to))),
    db.select({ count: count() }).from(shivaNotifications).where(and(gte(shivaNotifications.createdAt, from), lte(shivaNotifications.createdAt, to))),
    db.select({ count: count() }).from(simchas).where(and(gte(simchas.createdAt, from), lte(simchas.createdAt, to))),
    db.select({ count: count() }).from(tehillimList).where(and(gte(tehillimList.createdAt, from), lte(tehillimList.createdAt, to))),
    db.select({ count: count() }).from(askTheRabbi).where(and(gte(askTheRabbi.createdAt, from), lte(askTheRabbi.createdAt, to))),
    db.select({ count: count() }).from(businesses).where(and(gte(businesses.createdAt, prevFrom), lte(businesses.createdAt, prevTo))),
    db.select({ count: count() }).from(events).where(and(gte(events.createdAt, prevFrom), lte(events.createdAt, prevTo))),
    db.select({ count: count() }).from(blogPosts).where(and(gte(blogPosts.createdAt, prevFrom), lte(blogPosts.createdAt, prevTo))),
    db.select({ count: count() }).from(classifieds).where(and(gte(classifieds.createdAt, prevFrom), lte(classifieds.createdAt, prevTo))),
    db.select({ count: count() }).from(shiurim).where(and(gte(shiurim.createdAt, prevFrom), lte(shiurim.createdAt, prevTo))),
    db.select({ count: count() }).from(shivaNotifications).where(and(gte(shivaNotifications.createdAt, prevFrom), lte(shivaNotifications.createdAt, prevTo))),
    db.select({ count: count() }).from(simchas).where(and(gte(simchas.createdAt, prevFrom), lte(simchas.createdAt, prevTo))),
    db.select({ count: count() }).from(tehillimList).where(and(gte(tehillimList.createdAt, prevFrom), lte(tehillimList.createdAt, prevTo))),
    db.select({ count: count() }).from(askTheRabbi).where(and(gte(askTheRabbi.createdAt, prevFrom), lte(askTheRabbi.createdAt, prevTo))),
  ]);

  return {
    overview: {
      totalViews: Number(currentOverview?.totalViews ?? 0),
      uniqueVisitors: Number(currentOverview?.uniqueVisitors ?? 0),
      newSignups: Number(currentSignups[0]?.count ?? 0),
      prevTotalViews: Number(prevOverview?.totalViews ?? 0),
      prevUniqueVisitors: Number(prevOverview?.uniqueVisitors ?? 0),
      prevNewSignups: Number(prevSignups[0]?.count ?? 0),
    },
    topPages: topPagesResult,
    topBusinesses: topBusinessesResult,
    topBlogPosts: topBlogPostsResult,
    topEvents: topEventsResult,
    topSearchQueries: topSearchQueriesResult,
    signupTrend,
    contentSubmissions: {
      businesses: Number(bizCount[0]?.count ?? 0),
      events: Number(eventCount[0]?.count ?? 0),
      blogPosts: Number(blogCount[0]?.count ?? 0),
      classifieds: Number(classifiedCount[0]?.count ?? 0),
      shiurim: Number(shiurCount[0]?.count ?? 0),
      shiva: Number(shivaCount[0]?.count ?? 0),
      simchas: Number(simchaCount[0]?.count ?? 0),
      tehillim: Number(tehillimCount[0]?.count ?? 0),
      askTheRabbi: Number(rabiCount[0]?.count ?? 0),
    },
    prevContentTotal:
      Number(prevBizCount[0]?.count ?? 0) +
      Number(prevEventCount[0]?.count ?? 0) +
      Number(prevBlogCount[0]?.count ?? 0) +
      Number(prevClassifiedCount[0]?.count ?? 0) +
      Number(prevShiurCount[0]?.count ?? 0) +
      Number(prevShivaCount[0]?.count ?? 0) +
      Number(prevSimchaCount[0]?.count ?? 0) +
      Number(prevTehillimCount[0]?.count ?? 0) +
      Number(prevRabiCount[0]?.count ?? 0),
  };
}
