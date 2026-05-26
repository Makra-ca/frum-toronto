# Analytics System Design Spec
**Date:** 2026-05-25
**Project:** FrumToronto

---

## 1. Overview

A custom, privacy-friendly analytics system built on Neon PostgreSQL. No third-party tracking scripts. All data stays in the app's own database.

**Goals:**
- Track page views (total + unique) per content entity
- Track user signups over time
- Track what users search for
- Surface top-performing content in a single admin dashboard
- Keep the existing `viewCount` increments on business/blog/event pages (display use), while the new `pageViews` table becomes the source of truth for analytics

**Out of scope for this phase:**
- Business owner self-serve analytics
- Real-time dashboards (polling/websockets)
- Geographic analytics
- Device/browser breakdowns
- Funnel analysis

**Charting library:** No recharts or other chart library is currently installed. The admin dashboard will use server-rendered HTML tables with inline trend indicators (up/down arrows + percentage), and a simple CSS bar chart for the signup trend. This avoids adding a heavy client-side dependency. If charts are needed later, add `recharts` via `npm install recharts`.

---

## 2. Database Schema

### 2.1 `pageViews` Table

```typescript
// src/lib/db/schema.ts — add to existing schema

export const pageViews = pgTable("page_views", {
  id: serial("id").primaryKey(),
  url: varchar("url", { length: 500 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }),        // 'business' | 'blog_post' | 'event' | 'shul' | 'classified' | 'ask_the_rabbi'
  entityId: integer("entity_id"),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  sessionId: varchar("session_id", { length: 255 }).notNull(), // anonymous session UUID from cookie
  ipAddress: varchar("ip_address", { length: 50 }).notNull(),
  userAgent: varchar("user_agent", { length: 500 }),
  referrer: varchar("referrer", { length: 500 }),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
});
```

**Indexes:**

```typescript
// In schema.ts alongside the table definition
export const pageViewsIndexes = {
  entityIdx: index("pv_entity_idx").on(pageViews.entityType, pageViews.entityId, pageViews.viewedAt),
  userIdx: index("pv_user_idx").on(pageViews.userId, pageViews.viewedAt),
  urlIdx: index("pv_url_idx").on(pageViews.url, pageViews.viewedAt),
  sessionIdx: index("pv_session_idx").on(pageViews.sessionId, pageViews.viewedAt),
};
```

**Raw SQL migration** (run via `npm run db:push` after schema update, or directly):

```sql
CREATE TABLE IF NOT EXISTS page_views (
  id          SERIAL PRIMARY KEY,
  url         VARCHAR(500) NOT NULL,
  entity_type VARCHAR(50),
  entity_id   INTEGER,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  session_id  VARCHAR(255) NOT NULL,
  ip_address  VARCHAR(50) NOT NULL,
  user_agent  VARCHAR(500),
  referrer    VARCHAR(500),
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX pv_entity_idx ON page_views (entity_type, entity_id, viewed_at);
CREATE INDEX pv_user_idx   ON page_views (user_id, viewed_at);
CREATE INDEX pv_url_idx    ON page_views (url, viewed_at);
CREATE INDEX pv_session_idx ON page_views (session_id, viewed_at);
```

---

### 2.2 `searchQueries` Table

```typescript
export const searchQueries = pgTable("search_queries", {
  id: serial("id").primaryKey(),
  query: varchar("query", { length: 500 }).notNull(),
  searchType: varchar("search_type", { length: 50 }).notNull(), // 'businesses' | 'events' | 'shuls' | 'shiurim' | 'ask_the_rabbi' | 'all'
  resultsCount: integer("results_count").notNull().default(0),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  sessionId: varchar("session_id", { length: 255 }).notNull(),
  searchedAt: timestamp("searched_at").defaultNow().notNull(),
});
```

**Indexes:**

```typescript
export const searchQueriesIndexes = {
  queryIdx: index("sq_query_idx").on(searchQueries.query, searchQueries.searchedAt),
  typeIdx: index("sq_type_idx").on(searchQueries.searchType, searchQueries.searchedAt),
};
```

**Raw SQL migration:**

```sql
CREATE TABLE IF NOT EXISTS search_queries (
  id            SERIAL PRIMARY KEY,
  query         VARCHAR(500) NOT NULL,
  search_type   VARCHAR(50) NOT NULL,
  results_count INTEGER NOT NULL DEFAULT 0,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  session_id    VARCHAR(255) NOT NULL,
  searched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX sq_query_idx ON search_queries (query, searched_at);
CREATE INDEX sq_type_idx  ON search_queries (search_type, searched_at);
```

---

## 3. Session Cookie Strategy

Anonymous users are identified by a UUID stored in a HttpOnly cookie. This is set server-side so it's not accessible to JavaScript and cannot be spoofed from the client.

**Cookie spec:**
- Name: `ft_session_id`
- Value: `crypto.randomUUID()` (Node.js built-in, no library needed)
- HttpOnly: true
- SameSite: Lax
- Secure: true (in production)
- Max-Age: 30 days (2592000 seconds)
- Path: /

**Where to set it:**

In `src/app/api/analytics/pageview/route.ts` (the page view API), read the cookie from the request. If it's missing, generate a new UUID and set it on the response. This means the cookie is lazily initialized on first tracked page view rather than on every request.

```typescript
// Reading session ID in the API route
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "ft_session_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getOrCreateSessionId(request: NextRequest): { sessionId: string; isNew: boolean } {
  const existing = request.cookies.get(COOKIE_NAME)?.value;
  if (existing) return { sessionId: existing, isNew: false };
  return { sessionId: crypto.randomUUID(), isNew: true };
}

// In the POST handler, after creating the response:
if (isNew) {
  response.cookies.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}
```

**Session ID in search queries:** The `UniversalSearch` component is a client component that calls `/api/search/suggestions`. That API route can read the cookie from the request headers using `request.cookies.get(COOKIE_NAME)` — the HttpOnly cookie is sent automatically by the browser.

---

## 4. Page View Tracking Implementation

### 4.1 API Route

**File:** `src/app/api/analytics/pageview/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { pageViews } from "@/lib/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

const COOKIE_NAME = "ft_session_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const DEDUP_WINDOW_HOURS = 24;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, entityType, entityId } = body;

    if (!url) {
      return NextResponse.json({ error: "url required" }, { status: 400 });
    }

    const session = await auth();
    const userId = session?.user?.id ? parseInt(session.user.id) : null;

    const existingSessionId = request.cookies.get(COOKIE_NAME)?.value;
    const sessionId = existingSessionId ?? crypto.randomUUID();
    const isNewSession = !existingSessionId;

    // Extract IP from headers (Vercel sets x-forwarded-for)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const userAgent = request.headers.get("user-agent") ?? undefined;
    const referrer = request.headers.get("referer") ?? undefined;

    // Deduplication check: same entity not viewed by same user/session in last 24h
    if (entityType && entityId) {
      const cutoff = new Date(Date.now() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000);

      const conditions = [
        eq(pageViews.entityType, entityType),
        eq(pageViews.entityId, parseInt(entityId)),
        gte(pageViews.viewedAt, cutoff),
      ];

      if (userId) {
        conditions.push(eq(pageViews.userId, userId));
      } else {
        conditions.push(eq(pageViews.sessionId, sessionId));
      }

      const [existing] = await db
        .select({ id: pageViews.id })
        .from(pageViews)
        .where(and(...conditions))
        .limit(1);

      if (existing) {
        // Already counted as unique — still return 200 but don't insert
        const response = NextResponse.json({ recorded: false });
        if (isNewSession) {
          response.cookies.set(COOKIE_NAME, sessionId, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: COOKIE_MAX_AGE,
            path: "/",
          });
        }
        return response;
      }
    }

    await db.insert(pageViews).values({
      url,
      entityType: entityType ?? null,
      entityId: entityId ? parseInt(entityId) : null,
      userId,
      sessionId,
      ipAddress: ip,
      userAgent,
      referrer,
    });

    const response = NextResponse.json({ recorded: true });
    if (isNewSession) {
      response.cookies.set(COOKIE_NAME, sessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: COOKIE_MAX_AGE,
        path: "/",
      });
    }
    return response;

  } catch (error) {
    console.error("[Analytics] pageview error:", error);
    // Never return an error to the client — analytics should be silent
    return NextResponse.json({ recorded: false });
  }
}
```

---

### 4.2 Client Hook

**File:** `src/hooks/usePageView.ts`

```typescript
"use client";

import { useEffect } from "react";

interface PageViewOptions {
  entityType?: string;
  entityId?: number | string;
}

export function usePageView(url: string, options: PageViewOptions = {}) {
  useEffect(() => {
    // Fire-and-forget: analytics must never block the UI
    fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        entityType: options.entityType,
        entityId: options.entityId,
      }),
    }).catch(() => {
      // Swallow errors silently
    });
  }, [url, options.entityType, options.entityId]);
}
```

---

### 4.3 Where to Add Tracking Calls

Add `usePageView` to the client wrapper or page component for each entity type. Pages that are currently server components need a thin client wrapper or a `"use client"` component added.

**The pattern for server component pages:** Create a small `PageViewTracker` client component that just calls the hook and renders nothing.

**File:** `src/components/analytics/PageViewTracker.tsx`

```typescript
"use client";

import { usePageView } from "@/hooks/usePageView";

interface Props {
  url: string;
  entityType?: string;
  entityId?: number | string;
}

export function PageViewTracker({ url, entityType, entityId }: Props) {
  usePageView(url, { entityType, entityId });
  return null;
}
```

Then drop `<PageViewTracker ... />` anywhere in the JSX of a server component page.

**Pages to instrument:**

| File | entityType | entityId |
|------|------------|----------|
| `src/app/(public)/directory/business/[slug]/page.tsx` | `business` | `business.id` |
| `src/app/(public)/community/calendar/[id]/page.tsx` | `event` | `event.id` |
| `src/app/blog/[slug]/page.tsx` | `blog_post` | `post.id` |
| `src/app/(public)/shuls/[slug]/page.tsx` | `shul` | `shul.id` |
| `src/app/(public)/classifieds/[id]/page.tsx` | `classified` | `classified.id` |
| `src/app/(public)/ask-the-rabbi/[id]/page.tsx` | `ask_the_rabbi` | `question.id` |

General pages (no entityId) to also instrument optionally:
- `/` (homepage)
- `/directory` (business listing)
- `/blog` (blog listing)
- `/community/calendar` (events listing)

---

## 5. Search Query Tracking Implementation

### 5.1 Where to Add

**File to modify:** `src/app/api/search/suggestions/route.ts`

After running the fuzzy search and obtaining results, insert a row into `searchQueries`. This is fire-and-forget — do not `await` it in the critical path.

```typescript
// At the top of the file
import { searchQueries } from "@/lib/db/schema";

// Inside the GET handler, after computing suggestions:
const query = searchParams.get("q")?.trim() ?? "";
const type = searchParams.get("type") ?? "all";

// ... existing search logic ...

// Log search query (non-blocking)
const sessionId = request.cookies.get("ft_session_id")?.value ?? "unknown";
const session = await auth(); // auth() is already called for some search types, reuse
const userId = session?.user?.id ? parseInt(session.user.id) : null;

if (query.length >= 2) {
  db.insert(searchQueries).values({
    query,
    searchType: type,
    resultsCount: suggestions.length,
    userId,
    sessionId,
  }).catch((err) => {
    console.error("[Analytics] Failed to log search query:", err);
  });
  // Intentionally NOT awaited
}
```

**Important:** The `auth()` call may already exist in the route if user-scoped results are needed. Reuse it rather than calling it twice.

---

## 6. Admin Analytics Dashboard

### 6.1 Route and Layout

**New page:** `src/app/(admin)/admin/analytics/page.tsx`

Add "Analytics" to the admin sidebar in `src/components/admin/AdminLayoutClient.tsx`. Insert it after "Approvals" in the nav list:

```typescript
{ href: "/admin/analytics", label: "Analytics", icon: BarChart2 }
```

Import `BarChart2` from `lucide-react`.

The page is a **server component** that accepts `searchParams` for the time range. It fetches all metrics server-side and renders them as static HTML — no client-side data fetching needed for initial load.

```typescript
// src/app/(admin)/admin/analytics/page.tsx
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { AnalyticsTimeRangeSelector } from "@/components/admin/analytics/AnalyticsTimeRangeSelector";
import { OverviewCards } from "@/components/admin/analytics/OverviewCards";
import { TopEntitiesTable } from "@/components/admin/analytics/TopEntitiesTable";
import { SignupTrendChart } from "@/components/admin/analytics/SignupTrendChart";
import { TopSearchQueries } from "@/components/admin/analytics/TopSearchQueries";
import { ContentSubmissions } from "@/components/admin/analytics/ContentSubmissions";
import { getAnalyticsData } from "@/lib/analytics/queries";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/");

  const params = await searchParams;
  const { dateFrom, dateTo, rangeLabel } = resolveTimeRange(params);

  const data = await getAnalyticsData(dateFrom, dateTo);

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">{rangeLabel}</p>
        </div>
        <AnalyticsTimeRangeSelector currentRange={params.range} currentFrom={params.from} currentTo={params.to} />
      </div>

      <OverviewCards data={data.overview} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopEntitiesTable title="Top Businesses" rows={data.topBusinesses} linkPrefix="/admin/businesses/" />
        <TopEntitiesTable title="Top Blog Posts" rows={data.topBlogPosts} linkPrefix="/admin/programs/blog/" />
      </div>

      <TopEntitiesTable title="Top Events" rows={data.topEvents} linkPrefix="/admin/programs/events/" />

      <SignupTrendChart data={data.signupTrend} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopSearchQueries rows={data.topSearchQueries} />
        <ContentSubmissions data={data.contentSubmissions} />
      </div>
    </div>
  );
}
```

---

### 6.2 Time Range Selector

**File:** `src/components/admin/analytics/AnalyticsTimeRangeSelector.tsx`

Client component. Renders three preset tabs (7 days, 30 days, 90 days) plus a custom date range picker using two `<input type="date">` fields. Navigation updates URL search params via `useRouter().push()`.

```typescript
"use client";

import { useRouter, usePathname } from "next/navigation";

const PRESETS = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
];

export function AnalyticsTimeRangeSelector({ currentRange, currentFrom, currentTo }) {
  const router = useRouter();
  const pathname = usePathname();

  const setPreset = (range: string) => {
    router.push(`${pathname}?range=${range}`);
  };

  const setCustom = (from: string, to: string) => {
    if (from && to) router.push(`${pathname}?from=${from}&to=${to}`);
  };

  // ... render tabs + date inputs
}
```

**Range resolution helper** (in the page file or a shared lib):

```typescript
function resolveTimeRange(params: { range?: string; from?: string; to?: string }) {
  const now = new Date();

  if (params.from && params.to) {
    return {
      dateFrom: new Date(params.from),
      dateTo: new Date(params.to + "T23:59:59"),
      rangeLabel: `${params.from} to ${params.to}`,
    };
  }

  const days = params.range === "90d" ? 90 : params.range === "7d" ? 7 : 30;
  const dateFrom = new Date(now);
  dateFrom.setDate(dateFrom.getDate() - days);

  return {
    dateFrom,
    dateTo: now,
    rangeLabel: `Last ${days} days`,
  };
}
```

---

### 6.3 Section: Overview Cards

Four stat cards in a row:

| Card | Metric | Source |
|------|--------|--------|
| Total Page Views | COUNT(*) from pageViews in range | `page_views` |
| Unique Visitors | COUNT(DISTINCT sessionId) from pageViews in range | `page_views` |
| New Signups | COUNT(*) from users WHERE createdAt in range | `users` |
| Active Content | COUNT of events + businesses + blog_posts published/approved + active | multiple tables |

Each card shows the current period value and a trend vs. the previous equivalent period (e.g., previous 30 days if current range is 30 days). Trend displayed as: `+12% ↑` in green or `-5% ↓` in red.

---

### 6.4 Section: Top Businesses / Blog Posts / Events Tables

Reusable `TopEntitiesTable` component.

**Columns:**
- Name (linked to admin edit page)
- Unique Views (in selected range)
- Total Views (in selected range)
- Trend vs previous period (`+N% ↑` or `-N% ↓`)

Trend calculation: compare unique views in current period to same-length previous period.

Top 10 per entity type.

---

### 6.5 Section: User Signups Over Time

**CSS bar chart** — no recharts. Renders a series of vertical bars using `div` elements with heights proportional to the max value in the dataset.

Each bar = one day (for 7d/30d) or one week (for 90d). X-axis labels show date. Tooltip on hover (CSS title attribute).

If recharts is later added, swap this component for a `<BarChart>` from recharts with the same data shape.

Data shape:
```typescript
interface SignupPoint {
  date: string;    // "2026-05-01"
  count: number;
}
```

---

### 6.6 Section: Top Search Queries

Table, 20 rows.

**Columns:**
- Query text
- Type (badge: businesses / events / all / etc.)
- Count (number of times searched in range)
- Avg Results

---

### 6.7 Section: Content Submissions

Simple stat list of new content submitted in the range, broken down by type.

| Type | Count |
|------|-------|
| Businesses | N |
| Events | N |
| Blog Posts | N |
| Classifieds | N |
| Shiurim | N |
| Shiva Notices | N |
| Simchas | N |
| Tehillim Requests | N |
| Ask the Rabbi | N |

---

## 7. New API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/analytics/pageview` | POST | None | Record a page view |
| `/api/admin/analytics/overview` | GET | Admin | Overview card metrics |
| `/api/admin/analytics/top-entities` | GET | Admin | Top businesses/posts/events |
| `/api/admin/analytics/signup-trend` | GET | Admin | Signup over time |
| `/api/admin/analytics/search-queries` | GET | Admin | Top search terms |
| `/api/admin/analytics/content-submissions` | GET | Admin | Content count by type |

**Note:** Since the analytics page is a server component fetching data directly via Drizzle, the `/api/admin/analytics/*` routes are optional — the page can import and call the query functions directly from `src/lib/analytics/queries.ts`. The API routes are useful if the dashboard ever needs client-side refresh without a full page reload.

---

## 8. Modified Files

### 8.1 `src/app/api/search/suggestions/route.ts`
- Add non-blocking insert into `searchQueries` after results are computed
- Read `ft_session_id` cookie from request
- Optionally call `auth()` for userId (only if not already called in the route)

### 8.2 `src/components/admin/AdminLayoutClient.tsx`
- Add Analytics link to `navItems` array with `BarChart2` icon from lucide-react

### 8.3 `src/lib/db/schema.ts`
- Add `pageViews` table definition
- Add `searchQueries` table definition

### 8.4 Entity detail pages — add `<PageViewTracker />`

These pages are server components. Drop the tracker component in their JSX:

```typescript
// src/app/(public)/directory/business/[slug]/page.tsx
import { PageViewTracker } from "@/components/analytics/PageViewTracker";

// Inside the returned JSX:
<PageViewTracker url={`/directory/business/${params.slug}`} entityType="business" entityId={business.id} />
```

Same pattern for: event detail, blog post detail, shul detail, classified detail, ask-the-rabbi detail.

---

## 9. Data Aggregation Queries

All queries live in `src/lib/analytics/queries.ts`. Use Drizzle ORM with `sql` tagged template for aggregation.

### 9.1 Total Page Views and Unique Visitors

```typescript
import { db } from "@/lib/db";
import { pageViews, users } from "@/lib/db/schema";
import { sql, and, gte, lte, count, countDistinct } from "drizzle-orm";

export async function getOverviewMetrics(from: Date, to: Date, prevFrom: Date, prevTo: Date) {
  const [current] = await db
    .select({
      totalViews: count(),
      uniqueVisitors: countDistinct(pageViews.sessionId),
    })
    .from(pageViews)
    .where(and(gte(pageViews.viewedAt, from), lte(pageViews.viewedAt, to)));

  const [previous] = await db
    .select({
      totalViews: count(),
      uniqueVisitors: countDistinct(pageViews.sessionId),
    })
    .from(pageViews)
    .where(and(gte(pageViews.viewedAt, prevFrom), lte(pageViews.viewedAt, prevTo)));

  return { current, previous };
}
```

### 9.2 Top Businesses by Unique Views

```typescript
export async function getTopBusinesses(from: Date, to: Date, prevFrom: Date, prevTo: Date) {
  // Current period
  const current = await db
    .select({
      entityId: pageViews.entityId,
      uniqueViews: countDistinct(pageViews.sessionId),
      totalViews: count(),
    })
    .from(pageViews)
    .where(
      and(
        eq(pageViews.entityType, "business"),
        gte(pageViews.viewedAt, from),
        lte(pageViews.viewedAt, to)
      )
    )
    .groupBy(pageViews.entityId)
    .orderBy(sql`count(distinct session_id) desc`)
    .limit(10);

  // Fetch business names
  const ids = current.map((r) => r.entityId).filter(Boolean) as number[];
  const businessNames = await db
    .select({ id: businesses.id, name: businesses.name })
    .from(businesses)
    .where(inArray(businesses.id, ids));

  // Previous period for trend
  const previous = await db
    .select({
      entityId: pageViews.entityId,
      uniqueViews: countDistinct(pageViews.sessionId),
    })
    .from(pageViews)
    .where(
      and(
        eq(pageViews.entityType, "business"),
        gte(pageViews.viewedAt, prevFrom),
        lte(pageViews.viewedAt, prevTo),
        inArray(pageViews.entityId, ids)
      )
    )
    .groupBy(pageViews.entityId);

  // Merge
  return current.map((row) => {
    const name = businessNames.find((b) => b.id === row.entityId)?.name ?? "Unknown";
    const prev = previous.find((p) => p.entityId === row.entityId)?.uniqueViews ?? 0;
    const trend = prev === 0 ? null : ((Number(row.uniqueViews) - Number(prev)) / Number(prev)) * 100;
    return { entityId: row.entityId, name, uniqueViews: row.uniqueViews, totalViews: row.totalViews, trend };
  });
}
```

The same pattern applies for `topBlogPosts` (entityType = `"blog_post"`) and `topEvents` (entityType = `"event"`).

### 9.3 User Signups Over Time (by day)

```typescript
export async function getSignupTrend(from: Date, to: Date): Promise<SignupPoint[]> {
  const rows = await db.execute(sql`
    SELECT
      DATE_TRUNC('day', created_at AT TIME ZONE 'America/Toronto') AS day,
      COUNT(*) AS count
    FROM users
    WHERE created_at >= ${from} AND created_at <= ${to}
    GROUP BY 1
    ORDER BY 1
  `);

  return rows.rows.map((r: any) => ({
    date: (r.day as Date).toISOString().slice(0, 10),
    count: Number(r.count),
  }));
}
```

For 90-day ranges, bucket by week instead of day:

```sql
DATE_TRUNC('week', created_at AT TIME ZONE 'America/Toronto') AS week
```

Determine bucketing automatically: if `(to - from) > 45 days` → use weeks.

### 9.4 Top Search Queries

```typescript
export async function getTopSearchQueries(from: Date, to: Date, limit = 20) {
  return await db
    .select({
      query: searchQueries.query,
      searchType: searchQueries.searchType,
      count: count(),
      avgResults: sql<number>`ROUND(AVG(results_count))`,
    })
    .from(searchQueries)
    .where(and(gte(searchQueries.searchedAt, from), lte(searchQueries.searchedAt, to)))
    .groupBy(searchQueries.query, searchQueries.searchType)
    .orderBy(sql`count(*) desc`)
    .limit(limit);
}
```

### 9.5 New Signups Count

```typescript
export async function getNewSignupsCount(from: Date, to: Date) {
  const [result] = await db
    .select({ count: count() })
    .from(users)
    .where(and(gte(users.createdAt, from), lte(users.createdAt, to)));
  return Number(result?.count ?? 0);
}
```

### 9.6 Content Submissions by Type

```typescript
export async function getContentSubmissions(from: Date, to: Date) {
  // One query per content type — simple and readable
  const [bizCount] = await db.select({ count: count() }).from(businesses)
    .where(and(gte(businesses.createdAt, from), lte(businesses.createdAt, to)));

  const [eventCount] = await db.select({ count: count() }).from(events)
    .where(and(gte(events.createdAt, from), lte(events.createdAt, to)));

  // ... repeat for blog posts, classifieds, shiurim, shiva, simchas, tehillim, askTheRabbi

  return {
    businesses: Number(bizCount?.count ?? 0),
    events: Number(eventCount?.count ?? 0),
    // ...
  };
}
```

---

## 10. Performance Considerations

### 10.1 Write Path (page view inserts)

- The `POST /api/analytics/pageview` insert is a single row insert — fast on Neon.
- The deduplication check (SELECT before INSERT) adds one round trip. This is acceptable for entity pages. For general page views (no entityId), skip the dedup check entirely.
- The dedup SELECT uses the compound index on `(entity_type, entity_id, viewed_at)` and filters by `userId` or `sessionId` — both indexed.

### 10.2 Read Path (admin dashboard)

- All aggregation queries use the existing indexes.
- The `getTopBusinesses` query issues a secondary SELECT for names after getting the top IDs. This is 2 queries but avoids a JOIN over a large `page_views` table.
- For 90-day ranges, the `page_views` table may have millions of rows. The `(entity_type, entity_id, viewed_at)` index covers the WHERE clause but the GROUP BY + COUNT DISTINCT on `session_id` still scans the matching rows. This is acceptable for an admin-only page.
- Add `export const dynamic = "force-dynamic"` to the analytics page since it always shows current data.
- If queries become slow at scale, consider a `MATERIALIZED VIEW` refreshed daily for top-entity stats. Not needed for the initial launch.

### 10.3 Fire-and-Forget Pattern

Both page view tracking (client `fetch` call) and search query logging (server non-awaited insert) are non-blocking. A failure in analytics must never affect the user-facing page.

- `usePageView` catches all errors silently.
- Search query insert uses `.catch()` with a console.error only.
- The page view API route catches all errors and returns `{ recorded: false }` with status 200 rather than 500.

### 10.4 Neon Auto-Suspend

Analytics inserts happen on page load — these are the same connections as all other DB queries. No polling is involved. Neon will auto-suspend normally between user sessions. No changes needed to the DB driver setup.

---

## 11. Edge Cases

**Bot/crawler traffic:** The `userAgent` column captures the user agent string. A future enhancement can filter out known bot user agents. For now, all requests are counted including bots. The admin dashboard can add a "Exclude known bots" filter later.

**VPN/shared IPs:** Unique view deduplication for anonymous users uses `sessionId` (cookie), not IP address. Two users behind the same IP with different cookies are counted as separate unique visitors.

**Logged-in users with no cookie:** If a user is logged in, the dedup check uses `userId`. The session cookie is still set for future anonymous sessions. No gap in tracking.

**User deletes account:** `userId` in `pageViews` and `searchQueries` is `ON DELETE SET NULL`. Historical view data is preserved but no longer linked to a user.

**Clock skew:** `viewedAt` and `searchedAt` use database `DEFAULT NOW()` (server time), not client time. No client clock skew possible.

**Very short query strings:** Search logging is gated on `query.length >= 2` to skip accidental single-character searches.

**entityId as string vs number:** The page view API accepts `entityId` as a string in the JSON body (since JSON doesn't distinguish numeric strings). Always `parseInt(entityId)` before inserting.

**Concurrent dedup race condition:** Two near-simultaneous page loads from the same user could both pass the dedup SELECT check before either INSERT completes. This would result in 2 rows instead of 1, overcounting unique views by 1. This is acceptable — the alternative (database-level unique constraint) would require a partial unique index with complex logic. The 24-hour dedup window makes re-occurrences statistically rare.

---

## 12. Migration Notes

### Step 1: Schema update

Add the two new tables to `src/lib/db/schema.ts`. Run:

```bash
npm run db:push
```

Verify tables exist in Drizzle Studio (`npm run db:studio`).

### Step 2: Deploy API route

Deploy `src/app/api/analytics/pageview/route.ts`. Test with:

```bash
curl -X POST https://frumtoronto.com/api/analytics/pageview \
  -H "Content-Type: application/json" \
  -d '{"url":"/","entityType":"business","entityId":1}'
```

Expected response: `{"recorded":true}` and a `Set-Cookie: ft_session_id=...` header on first call.

### Step 3: Instrument entity pages

Add `<PageViewTracker />` to the 6 entity detail pages. Deploy. Verify rows appear in `page_views` table.

### Step 4: Instrument search

Modify `/api/search/suggestions/route.ts` to log queries. Deploy. Run a few searches. Verify rows appear in `search_queries` table.

### Step 5: Build and deploy admin dashboard

Build the analytics page and all sub-components. Add sidebar link. Deploy. Navigate to `/admin/analytics`.

### Step 6: Verify deduplication

Open a business page. Reload it 5 times within 60 seconds. Check `page_views` — should have exactly 1 row for that session+entity combination.

### Rollback plan

If anything goes wrong:
- Remove `<PageViewTracker />` from pages to stop new inserts
- The `pageViews` and `searchQueries` tables can remain empty with no effect on app functionality
- Existing `viewCount` increments on business/blog/event pages are untouched and continue working independently
