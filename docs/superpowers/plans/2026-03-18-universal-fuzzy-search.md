# Universal Fuzzy Search Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all search implementations with a single `<UniversalSearch />` component backed by one unified API endpoint with PostgreSQL fuzzy matching.

**Architecture:** One shared React component (`UniversalSearch.tsx`) handles all search UI — dropdown, keyboard nav, highlighting. One API endpoint (`/api/search/suggestions`) accepts a `type` parameter to scope queries. A shared helper module (`fuzzy-search.ts`) builds the SQL queries per type. Trigram indexes on all searchable columns.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, PostgreSQL pg_trgm, TypeScript, Tailwind CSS, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-18-universal-fuzzy-search-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/lib/search/types.ts` | Shared types: `SearchSuggestion`, `SearchType`, props interfaces |
| `src/lib/search/fuzzy-search.ts` | Per-type query builders that return `SearchSuggestion[]` |
| `src/components/search/UniversalSearch.tsx` | Reusable search component with dropdown, keyboard nav, highlighting |
| `src/app/api/search/suggestions/route.ts` | Unified API endpoint that delegates to fuzzy-search.ts |
| `scripts/enable-universal-search-indexes.ts` | Creates trigram indexes on all searchable tables |

**Files modified:** HeroSection.tsx, ask-the-rabbi/page.tsx, shuls/page.tsx, shiurim/page.tsx, calendar/page.tsx, directory/search/page.tsx, ClassifiedsBrowser.tsx, search/page.tsx

**Files removed (after all integrations work):** AskTheRabbiSearch.tsx, DirectorySearch.tsx, api/ask-the-rabbi/search/route.ts, api/search/route.ts

---

## Chunk 1: Foundation (Types + DB Indexes + Query Builders + API)

### Task 1: Create shared search types

**Files:**
- Create: `src/lib/search/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/lib/search/types.ts

export type SearchType =
  | "businesses"
  | "classifieds"
  | "shuls"
  | "shiurim"
  | "events"
  | "ask-the-rabbi"
  | "all";

export interface SearchSuggestion {
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  type: SearchType;
  relevanceScore: number;
}

export interface SuggestionsResponse {
  suggestions: SearchSuggestion[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/search/types.ts
git commit -m "feat: add shared search types for universal fuzzy search"
```

---

### Task 2: Create trigram indexes script

**Files:**
- Create: `scripts/enable-universal-search-indexes.ts`
- Reference: `scripts/enable-fuzzy-search.ts` (existing pattern)

- [ ] **Step 1: Create the index script**

```typescript
// scripts/enable-universal-search-indexes.ts
import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function enableUniversalSearchIndexes() {
  console.log("Ensuring pg_trgm extension is enabled...");
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

  console.log("Creating trigram indexes...");

  // Shuls
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_shuls_name_trgm ON shuls USING GIN (name gin_trgm_ops)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_shuls_rabbi_trgm ON shuls USING GIN (rabbi gin_trgm_ops)`);

  // Shiurim
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_shiurim_title_trgm ON shiurim USING GIN (title gin_trgm_ops)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_shiurim_teacher_trgm ON shiurim USING GIN (teacher_name gin_trgm_ops)`);

  // Events
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_events_title_trgm ON events USING GIN (title gin_trgm_ops)`);

  // Businesses
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_businesses_name_trgm ON businesses USING GIN (name gin_trgm_ops)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_businesses_description_trgm ON businesses USING GIN (description gin_trgm_ops)`);

  // Classifieds
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_classifieds_title_trgm ON classifieds USING GIN (title gin_trgm_ops)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_classifieds_description_trgm ON classifieds USING GIN (description gin_trgm_ops)`);

  // Ask the Rabbi indexes already exist (from enable-fuzzy-search.ts)

  console.log("All trigram indexes created successfully!");
  process.exit(0);
}

enableUniversalSearchIndexes().catch((err) => {
  console.error("Error creating indexes:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the script to create indexes**

```bash
npx tsx scripts/enable-universal-search-indexes.ts
```

Expected: "All trigram indexes created successfully!"

- [ ] **Step 3: Commit**

```bash
git add scripts/enable-universal-search-indexes.ts
git commit -m "feat: add trigram indexes for universal fuzzy search"
```

---

### Task 3: Create fuzzy search query builders

**Files:**
- Create: `src/lib/search/fuzzy-search.ts`
- Reference: `src/app/api/ask-the-rabbi/search/route.ts` (existing fuzzy logic)
- Reference: `src/app/api/search/route.ts` (existing scoring logic)
- Reference: `src/lib/db/schema.ts` (column names)

This is the core module. Each function queries one table and returns `SearchSuggestion[]`.

- [ ] **Step 1: Create the fuzzy search module**

```typescript
// src/lib/search/fuzzy-search.ts
import { db } from "@/lib/db";
import {
  businesses,
  businessCategories,
  classifieds,
  classifiedCategories,
  shuls,
  shiurim,
  events,
  askTheRabbi,
} from "@/lib/db/schema";
import { eq, and, or, sql, desc } from "drizzle-orm";
import type { SearchSuggestion, SearchType } from "./types";

// ─── Helpers ──────────────────────────────────────────────

function parseWords(query: string, maxWords = 5): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, maxWords);
}

function buildWordConditions(
  words: string[],
  fields: { column: ReturnType<typeof sql>; threshold: number }[]
) {
  return words.map(
    (word) =>
      sql`(${sql.join(
        fields.flatMap((f) => [
          sql`${f.column} ILIKE ${"%" + word + "%"}`,
          sql`word_similarity(${word}, ${f.column}) > ${f.threshold}`,
        ]),
        sql` OR `
      )})`
  );
}

function calculateScore(
  query: string,
  primaryValue: string,
  secondaryValue: string | null,
  primarySimilarity: number,
  secondarySimilarity: number
): number {
  const queryLower = query.toLowerCase();
  const primaryLower = primaryValue.toLowerCase();
  const secondaryLower = (secondaryValue || "").toLowerCase();

  let score = 0;

  // Primary field scoring
  if (primaryLower === queryLower) score += 150;
  else if (primaryLower.startsWith(queryLower)) score += 120;
  else if (primaryLower.includes(queryLower)) score += 100;

  // Secondary field scoring
  if (secondaryLower && secondaryLower.includes(queryLower)) score += 50;

  // Fuzzy similarity scores
  score += (primarySimilarity || 0) * 80;
  score += (secondarySimilarity || 0) * 40;

  return score;
}

// ─── Per-Type Query Functions ────────────────────────────

export async function searchBusinesses(
  query: string,
  limit: number
): Promise<SearchSuggestion[]> {
  const queryLower = query.toLowerCase();
  const searchTerm = `%${query}%`;

  const results = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      slug: businesses.slug,
      description: businesses.description,
      categoryName: businessCategories.name,
      nameSimilarity: sql<number>`GREATEST(
        similarity(LOWER(${businesses.name}), ${queryLower}),
        word_similarity(${queryLower}, LOWER(${businesses.name}))
      )`,
      catSimilarity: sql<number>`COALESCE(similarity(LOWER(${businessCategories.name}), ${queryLower}), 0)`,
    })
    .from(businesses)
    .leftJoin(businessCategories, eq(businesses.categoryId, businessCategories.id))
    .where(
      and(
        eq(businesses.approvalStatus, "approved"),
        eq(businesses.isActive, true),
        or(
          sql`LOWER(${businesses.name}) LIKE LOWER(${searchTerm})`,
          sql`LOWER(${businesses.description}) LIKE LOWER(${searchTerm})`,
          sql`LOWER(${businessCategories.name}) LIKE LOWER(${searchTerm})`,
          sql`similarity(LOWER(${businesses.name}), ${queryLower}) > 0.2`,
          sql`word_similarity(${queryLower}, LOWER(${businesses.name})) > 0.3`
        )
      )
    )
    .limit(limit);

  return results.map((b) => ({
    id: String(b.id),
    title: b.name,
    subtitle: b.categoryName || undefined,
    url: `/directory/business/${b.slug}`,
    type: "businesses" as SearchType,
    relevanceScore: calculateScore(
      query,
      b.name,
      b.categoryName,
      Number(b.nameSimilarity),
      Number(b.catSimilarity)
    ),
  }));
}

export async function searchClassifieds(
  query: string,
  limit: number
): Promise<SearchSuggestion[]> {
  const queryLower = query.toLowerCase();
  const searchTerm = `%${query}%`;

  const results = await db
    .select({
      id: classifieds.id,
      title: classifieds.title,
      categoryName: classifiedCategories.name,
      titleSimilarity: sql<number>`GREATEST(
        similarity(LOWER(${classifieds.title}), ${queryLower}),
        word_similarity(${queryLower}, LOWER(${classifieds.title}))
      )`,
      catSimilarity: sql<number>`COALESCE(similarity(LOWER(${classifiedCategories.name}), ${queryLower}), 0)`,
    })
    .from(classifieds)
    .leftJoin(classifiedCategories, eq(classifieds.categoryId, classifiedCategories.id))
    .where(
      and(
        eq(classifieds.approvalStatus, "approved"),
        eq(classifieds.isActive, true),
        or(
          sql`LOWER(${classifieds.title}) LIKE LOWER(${searchTerm})`,
          sql`LOWER(${classifieds.description}) LIKE LOWER(${searchTerm})`,
          sql`LOWER(${classifiedCategories.name}) LIKE LOWER(${searchTerm})`,
          sql`similarity(LOWER(${classifieds.title}), ${queryLower}) > 0.2`,
          sql`word_similarity(${queryLower}, LOWER(${classifieds.title})) > 0.3`
        )
      )
    )
    .limit(limit);

  return results.map((c) => ({
    id: String(c.id),
    title: c.title,
    subtitle: c.categoryName || undefined,
    url: `/classifieds/${c.id}`,
    type: "classifieds" as SearchType,
    relevanceScore: calculateScore(
      query,
      c.title,
      c.categoryName,
      Number(c.titleSimilarity),
      Number(c.catSimilarity)
    ),
  }));
}

export async function searchShuls(
  query: string,
  limit: number
): Promise<SearchSuggestion[]> {
  const queryLower = query.toLowerCase();
  const searchTerm = `%${query}%`;

  const results = await db
    .select({
      id: shuls.id,
      name: shuls.name,
      slug: shuls.slug,
      rabbi: shuls.rabbi,
      denomination: shuls.denomination,
      address: shuls.address,
      nameSimilarity: sql<number>`GREATEST(
        similarity(LOWER(${shuls.name}), ${queryLower}),
        word_similarity(${queryLower}, LOWER(${shuls.name}))
      )`,
      rabbiSimilarity: sql<number>`COALESCE(
        GREATEST(
          similarity(LOWER(${shuls.rabbi}), ${queryLower}),
          word_similarity(${queryLower}, LOWER(${shuls.rabbi}))
        ), 0
      )`,
    })
    .from(shuls)
    .where(
      and(
        eq(shuls.isActive, true),
        or(
          sql`LOWER(${shuls.name}) LIKE LOWER(${searchTerm})`,
          sql`LOWER(${shuls.rabbi}) LIKE LOWER(${searchTerm})`,
          sql`LOWER(${shuls.address}) LIKE LOWER(${searchTerm})`,
          sql`similarity(LOWER(${shuls.name}), ${queryLower}) > 0.2`,
          sql`word_similarity(${queryLower}, LOWER(${shuls.name})) > 0.3`,
          sql`word_similarity(${queryLower}, COALESCE(LOWER(${shuls.rabbi}), '')) > 0.3`
        )
      )
    )
    .limit(limit);

  return results.map((s) => {
    const subtitleParts: string[] = [];
    if (s.denomination) subtitleParts.push(s.denomination);
    if (s.rabbi) subtitleParts.push(`Rabbi ${s.rabbi}`);
    return {
      id: String(s.id),
      title: s.name,
      subtitle: subtitleParts.join(" - ") || undefined,
      url: `/shuls/${s.slug}`,
      type: "shuls" as SearchType,
      relevanceScore: calculateScore(
        query,
        s.name,
        s.rabbi,
        Number(s.nameSimilarity),
        Number(s.rabbiSimilarity)
      ),
    };
  });
}

export async function searchShiurim(
  query: string,
  limit: number
): Promise<SearchSuggestion[]> {
  const queryLower = query.toLowerCase();
  const searchTerm = `%${query}%`;

  const results = await db
    .select({
      id: shiurim.id,
      title: shiurim.title,
      teacherName: shiurim.teacherName,
      category: shiurim.category,
      projectOf: shiurim.projectOf,
      titleSimilarity: sql<number>`GREATEST(
        similarity(LOWER(${shiurim.title}), ${queryLower}),
        word_similarity(${queryLower}, LOWER(${shiurim.title}))
      )`,
      teacherSimilarity: sql<number>`COALESCE(
        GREATEST(
          similarity(LOWER(${shiurim.teacherName}), ${queryLower}),
          word_similarity(${queryLower}, LOWER(${shiurim.teacherName}))
        ), 0
      )`,
    })
    .from(shiurim)
    .where(
      and(
        eq(shiurim.isActive, true),
        eq(shiurim.approvalStatus, "approved"),
        or(
          sql`LOWER(${shiurim.title}) LIKE LOWER(${searchTerm})`,
          sql`LOWER(${shiurim.teacherName}) LIKE LOWER(${searchTerm})`,
          sql`LOWER(${shiurim.projectOf}) LIKE LOWER(${searchTerm})`,
          sql`similarity(LOWER(${shiurim.title}), ${queryLower}) > 0.2`,
          sql`word_similarity(${queryLower}, LOWER(${shiurim.title})) > 0.3`,
          sql`word_similarity(${queryLower}, LOWER(${shiurim.teacherName})) > 0.3`
        )
      )
    )
    .limit(limit);

  return results.map((s) => {
    const subtitleParts: string[] = [];
    if (s.teacherName) subtitleParts.push(s.teacherName);
    if (s.category) subtitleParts.push(s.category);
    return {
      id: String(s.id),
      title: s.title,
      subtitle: subtitleParts.join(" - ") || undefined,
      url: `/shiurim/${s.id}`,
      type: "shiurim" as SearchType,
      relevanceScore: calculateScore(
        query,
        s.title,
        s.teacherName,
        Number(s.titleSimilarity),
        Number(s.teacherSimilarity)
      ),
    };
  });
}

export async function searchEvents(
  query: string,
  limit: number
): Promise<SearchSuggestion[]> {
  const queryLower = query.toLowerCase();
  const searchTerm = `%${query}%`;

  const results = await db
    .select({
      id: events.id,
      title: events.title,
      location: events.location,
      eventType: events.eventType,
      startTime: events.startTime,
      titleSimilarity: sql<number>`GREATEST(
        similarity(LOWER(${events.title}), ${queryLower}),
        word_similarity(${queryLower}, LOWER(${events.title}))
      )`,
    })
    .from(events)
    .where(
      and(
        eq(events.isActive, true),
        eq(events.approvalStatus, "approved"),
        sql`${events.startTime} >= NOW()`,
        or(
          sql`LOWER(${events.title}) LIKE LOWER(${searchTerm})`,
          sql`LOWER(${events.description}) LIKE LOWER(${searchTerm})`,
          sql`LOWER(${events.location}) LIKE LOWER(${searchTerm})`,
          sql`similarity(LOWER(${events.title}), ${queryLower}) > 0.2`,
          sql`word_similarity(${queryLower}, LOWER(${events.title})) > 0.3`
        )
      )
    )
    .limit(limit);

  const EVENT_TYPE_LABELS: Record<string, string> = {
    community: "Community Event",
    fundraising: "Fundraising Event",
    school: "School Information",
    wedding: "Wedding",
  };

  return results.map((e) => {
    const subtitleParts: string[] = [];
    if (e.startTime) {
      subtitleParts.push(
        new Date(e.startTime).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      );
    }
    if (e.eventType) {
      subtitleParts.push(EVENT_TYPE_LABELS[e.eventType] || e.eventType);
    }
    return {
      id: String(e.id),
      title: e.title,
      subtitle: subtitleParts.join(" - ") || undefined,
      url: `/community/calendar/${e.id}`,
      type: "events" as SearchType,
      relevanceScore: calculateScore(
        query,
        e.title,
        e.location,
        Number(e.titleSimilarity),
        0
      ),
    };
  });
}

export async function searchAskTheRabbi(
  query: string,
  limit: number
): Promise<SearchSuggestion[]> {
  const words = parseWords(query);
  if (words.length === 0) return [];

  const wordConditions = words.map(
    (word) => sql`(
      ${askTheRabbi.title} ILIKE ${"%" + word + "%"}
      OR ${askTheRabbi.question} ILIKE ${"%" + word + "%"}
      OR word_similarity(${word}, ${askTheRabbi.title}) > 0.4
      OR word_similarity(${word}, ${askTheRabbi.question}) > 0.35
    )`
  );

  const exactTitleMatches = words.map(
    (word) =>
      sql`CASE WHEN ${askTheRabbi.title} ILIKE ${"%" + word + "%"} THEN 1 ELSE 0 END`
  );
  const exactQuestionMatches = words.map(
    (word) =>
      sql`CASE WHEN ${askTheRabbi.question} ILIKE ${"%" + word + "%"} THEN 1 ELSE 0 END`
  );
  const fuzzySimilarities = words.map(
    (word) =>
      sql`GREATEST(
        word_similarity(${word}, ${askTheRabbi.title}),
        word_similarity(${word}, ${askTheRabbi.question}) * 0.9
      )`
  );

  const results = await db
    .select({
      id: askTheRabbi.id,
      questionNumber: askTheRabbi.questionNumber,
      title: askTheRabbi.title,
      question: askTheRabbi.question,
    })
    .from(askTheRabbi)
    .where(and(eq(askTheRabbi.isPublished, true), ...wordConditions))
    .orderBy(
      sql`(${sql.join(exactTitleMatches, sql` + `)}) DESC`,
      sql`(${sql.join(exactQuestionMatches, sql` + `)}) DESC`,
      sql`(${sql.join(fuzzySimilarities, sql` + `)}) DESC`,
      desc(askTheRabbi.questionNumber)
    )
    .limit(limit);

  return results.map((a, index) => ({
    id: String(a.id),
    title: a.title,
    subtitle: a.questionNumber ? `#${a.questionNumber}` : undefined,
    url: `/ask-the-rabbi/${a.id}`,
    type: "ask-the-rabbi" as SearchType,
    // Use index-based scoring since results are already ranked by SQL ORDER BY
    relevanceScore: 1000 - index * 10,
  }));
}

// ─── Unified Search ──────────────────────────────────────

export async function searchAll(
  query: string,
  limit: number
): Promise<SearchSuggestion[]> {
  const perTypeLimit = 3;

  const [biz, cls, shl, shr, evt, atr] = await Promise.all([
    searchBusinesses(query, perTypeLimit),
    searchClassifieds(query, perTypeLimit),
    searchShuls(query, perTypeLimit),
    searchShiurim(query, perTypeLimit),
    searchEvents(query, perTypeLimit),
    searchAskTheRabbi(query, perTypeLimit),
  ]);

  const all = [...biz, ...cls, ...shl, ...shr, ...evt, ...atr];
  all.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return all.slice(0, limit);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/search/fuzzy-search.ts
git commit -m "feat: add fuzzy search query builders for all content types"
```

---

### Task 4: Create the unified suggestions API endpoint

**Files:**
- Create: `src/app/api/search/suggestions/route.ts`

- [ ] **Step 1: Create the API route**

```typescript
// src/app/api/search/suggestions/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  searchBusinesses,
  searchClassifieds,
  searchShuls,
  searchShiurim,
  searchEvents,
  searchAskTheRabbi,
  searchAll,
} from "@/lib/search/fuzzy-search";
import type { SearchType, SuggestionsResponse } from "@/lib/search/types";

export const dynamic = "force-dynamic";

const searchFunctions: Record<
  Exclude<SearchType, "all">,
  (query: string, limit: number) => Promise<import("@/lib/search/types").SearchSuggestion[]>
> = {
  businesses: searchBusinesses,
  classifieds: searchClassifieds,
  shuls: searchShuls,
  shiurim: searchShiurim,
  events: searchEvents,
  "ask-the-rabbi": searchAskTheRabbi,
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";
  const type = searchParams.get("type") as SearchType | null;
  const limit = Math.min(parseInt(searchParams.get("limit") || "8"), 20);

  if (!type) {
    return NextResponse.json(
      { error: "type parameter is required" },
      { status: 400 }
    );
  }

  const minChars = type === "all" ? 3 : 2;
  if (query.length < minChars) {
    return NextResponse.json({ suggestions: [] } satisfies SuggestionsResponse);
  }

  try {
    let suggestions;

    if (type === "all") {
      suggestions = await searchAll(query, limit);
    } else {
      const searchFn = searchFunctions[type];
      if (!searchFn) {
        return NextResponse.json(
          { error: `Invalid search type: ${type}` },
          { status: 400 }
        );
      }
      suggestions = await searchFn(query, limit);
    }

    // Sort by relevance (may already be sorted, but ensure consistency)
    suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return NextResponse.json({ suggestions } satisfies SuggestionsResponse);
  } catch (error) {
    console.error(`[API] Search suggestions error (type=${type}):`, error);
    return NextResponse.json({ suggestions: [] } satisfies SuggestionsResponse);
  }
}
```

- [ ] **Step 2: Verify endpoint works manually**

Start dev server and test:
```
GET /api/search/suggestions?type=shuls&q=beth
GET /api/search/suggestions?type=businesses&q=kosher
GET /api/search/suggestions?type=all&q=torah
GET /api/search/suggestions?type=ask-the-rabbi&q=purim
```

Expected: JSON with `{ suggestions: [...] }` for each.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/search/suggestions/route.ts
git commit -m "feat: add unified search suggestions API endpoint"
```

---

## Chunk 2: UniversalSearch Component

### Task 5: Build the UniversalSearch component

**Files:**
- Create: `src/components/search/UniversalSearch.tsx`
- Reference: `src/components/ask-the-rabbi/AskTheRabbiSearch.tsx` (existing pattern to replicate)

This component is modeled on `AskTheRabbiSearch.tsx` but generalized with `searchType` prop.

- [ ] **Step 1: Create the component**

```tsx
// src/components/search/UniversalSearch.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { SearchSuggestion, SearchType } from "@/lib/search/types";

interface UniversalSearchProps {
  searchType: SearchType;
  placeholder?: string;
  onSearch?: (query: string) => void;
  className?: string;
  minChars?: number;
  maxSuggestions?: number;
  initialQuery?: string;
}

// Type labels for "all" mode badges
const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  businesses: { label: "Business", color: "bg-blue-100 text-blue-700" },
  classifieds: { label: "Classified", color: "bg-green-100 text-green-700" },
  shuls: { label: "Shul", color: "bg-amber-100 text-amber-700" },
  shiurim: { label: "Shiur", color: "bg-teal-100 text-teal-700" },
  events: { label: "Event", color: "bg-pink-100 text-pink-700" },
  "ask-the-rabbi": { label: "Ask the Rabbi", color: "bg-purple-100 text-purple-700" },
};

export function UniversalSearch({
  searchType,
  placeholder = "Search...",
  onSearch,
  className = "",
  minChars,
  maxSuggestions = 8,
  initialQuery = "",
}: UniversalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const effectiveMinChars = minChars ?? (searchType === "all" ? 3 : 2);

  // Fetch suggestions
  const fetchSuggestions = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < effectiveMinChars) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      // Cancel previous request
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/search/suggestions?type=${searchType}&q=${encodeURIComponent(searchQuery)}&limit=${maxSuggestions}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setIsOpen((data.suggestions?.length ?? 0) > 0);
        setSelectedIndex(-1);
      } catch (error: unknown) {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("Error fetching suggestions:", error);
          setSuggestions([]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [searchType, effectiveMinChars, maxSuggestions]
  );

  // Debounced input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  };

  // Handle Enter / full search
  const handleSearch = () => {
    if (query.trim()) {
      onSearch?.(query.trim());
    }
    setIsOpen(false);
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    router.push(suggestion.url);
    setIsOpen(false);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && e.key !== "Enter") return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSuggestionClick(suggestions[selectedIndex]);
        } else {
          handleSearch();
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Clear search
  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Highlight matching text (multi-word)
  const highlightMatch = (text: string, q: string) => {
    if (!q.trim()) return text;

    const words = q
      .trim()
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

    if (words.length === 0) return text;

    const regex = new RegExp(`(${words.join("|")})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 text-gray-900 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const showAllMode = searchType === "all";

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="pl-12 pr-20 h-14 bg-white text-gray-900 border-0 text-base rounded-xl shadow-lg focus-visible:ring-2 focus-visible:ring-blue-400"
          autoComplete="off"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && (
            <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
          )}
          {query && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50">
          <div className="py-2">
            {suggestions.map((suggestion, index) => {
              const typeInfo = TYPE_LABELS[suggestion.type];
              return (
                <button
                  key={`${suggestion.type}-${suggestion.id}`}
                  onClick={() => handleSuggestionClick(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    selectedIndex === index ? "bg-blue-50" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {showAllMode && typeInfo && (
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded ${typeInfo.color}`}
                          >
                            {typeInfo.label}
                          </span>
                        )}
                        {suggestion.subtitle && (
                          <span className="text-xs text-gray-500">
                            {suggestion.subtitle}
                          </span>
                        )}
                      </div>
                      <div className="font-medium text-gray-900 text-sm leading-snug">
                        {highlightMatch(suggestion.title, query)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Search all results footer */}
          {onSearch && (
            <button
              onClick={handleSearch}
              className="w-full px-4 py-3 text-left border-t border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 text-blue-600">
                <Search className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Search all results for &quot;{query}&quot;
                </span>
              </div>
            </button>
          )}
        </div>
      )}

      {/* No results */}
      {isOpen &&
        query.length >= effectiveMinChars &&
        suggestions.length === 0 &&
        !isLoading && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50">
            <div className="px-4 py-6 text-center">
              <p className="text-gray-500 text-sm">No results found</p>
              {onSearch && (
                <button
                  onClick={handleSearch}
                  className="mt-2 text-blue-600 text-sm font-medium hover:underline"
                >
                  Search anyway
                </button>
              )}
            </div>
          </div>
        )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/search/UniversalSearch.tsx
git commit -m "feat: add UniversalSearch component with dropdown, keyboard nav, highlighting"
```

---

## Chunk 3: Integrate into pages with NO existing search

### Task 6: Add search to Shuls page

**Files:**
- Modify: `src/app/(public)/shuls/page.tsx`

The shuls page currently fetches all shuls and filters client-side by denomination/nusach. We add `<UniversalSearch>` above the filter bar. The `onSearch` callback will add a `q` param and re-fetch, or filter client-side.

- [ ] **Step 1: Add UniversalSearch import and search state**

At the top of the client component in `src/app/(public)/shuls/page.tsx`, add:

```typescript
import { UniversalSearch } from "@/components/search/UniversalSearch";
```

Add a `searchQuery` state variable alongside the existing filter states. Add `onSearch` handler that sets the search query and filters the displayed shuls client-side (case-insensitive match on name, rabbi, address).

- [ ] **Step 2: Add UniversalSearch to the UI**

Place `<UniversalSearch searchType="shuls" placeholder="Search shuls..." onSearch={handleSearch} className="max-w-xl" />` above the denomination/nusach filter dropdowns.

Update the existing filter logic to also filter by the search query text (ILIKE-style: check if name, rabbi, or address includes the query string case-insensitively).

- [ ] **Step 3: Test manually**

- Visit `/shuls`
- Type "beth" → dropdown should show matching shuls
- Click a suggestion → should navigate to `/shuls/[slug]`
- Press Enter → should filter the list below
- Use denomination filter alongside search → both should apply

- [ ] **Step 4: Commit**

```bash
git add src/app/(public)/shuls/page.tsx
git commit -m "feat: add fuzzy search to shuls page"
```

---

### Task 7: Add search to Shiurim page

**Files:**
- Modify: `src/app/(public)/shiurim/page.tsx`

Same pattern as shuls. Add `<UniversalSearch>` above the existing 7 filter dropdowns.

- [ ] **Step 1: Add UniversalSearch and search state**

Import `UniversalSearch`. Add `searchQuery` state. Add `onSearch` handler that filters the shiurim list by matching title, teacherName, or projectOf.

- [ ] **Step 2: Add to UI above filters**

Place `<UniversalSearch searchType="shiurim" placeholder="Search shiurim..." onSearch={handleSearch} className="max-w-xl" />` above the filter row.

Update the existing filter/display logic to also apply the search query filter.

- [ ] **Step 3: Test manually**

- Visit `/shiurim`
- Type a teacher name → dropdown shows matching shiurim
- Click suggestion → navigates to `/shiurim/[id]`
- Enter → filters list
- Filters + search work together

- [ ] **Step 4: Commit**

```bash
git add src/app/(public)/shiurim/page.tsx
git commit -m "feat: add fuzzy search to shiurim page"
```

---

### Task 8: Add search to Calendar page

**Files:**
- Modify: `src/app/(public)/community/calendar/page.tsx`

Add `<UniversalSearch>` above the view toggle and event type filters.

- [ ] **Step 1: Add UniversalSearch and search state**

Import `UniversalSearch`. Add `searchQuery` state. Add `onSearch` handler that filters the events list by matching title, description, or location.

- [ ] **Step 2: Add to UI above controls**

Place `<UniversalSearch searchType="events" placeholder="Search events..." onSearch={handleSearch} className="max-w-xl" />` above the view toggle / event type filter buttons.

Update event filtering logic to also apply the search query.

- [ ] **Step 3: Test manually**

- Visit `/community/calendar`
- Type an event name → dropdown shows matching events with date subtitle
- Click suggestion → navigates to `/community/calendar/[id]`
- Enter → filters events in both calendar and list views
- Event type filter + search work together

- [ ] **Step 4: Commit**

```bash
git add src/app/(public)/community/calendar/page.tsx
git commit -m "feat: add fuzzy search to calendar events page"
```

---

## Chunk 4: Upgrade existing search pages

### Task 9: Upgrade Directory search

**Files:**
- Modify: `src/app/directory/search/page.tsx`

The directory search page currently has a basic search form in the header. Replace with `<UniversalSearch>` for the dropdown experience while keeping existing filters (city, category, sort) and server-side pagination.

- [ ] **Step 1: Replace search form with UniversalSearch**

Import `UniversalSearch`. Replace the search form `<form>` block in the header (around lines 262-278) with:

```tsx
<UniversalSearch
  searchType="businesses"
  placeholder="Search businesses..."
  initialQuery={searchQuery}
  onSearch={(q) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("q", q);
    params.set("page", "1");
    router.push(`/directory/search?${params.toString()}`);
  }}
  className="max-w-2xl"
/>
```

Keep the existing server-side search logic for the main results list (the ILIKE matching when `q` param is present). The dropdown provides quick navigation; Enter triggers the full page search.

- [ ] **Step 2: Test manually**

- Visit `/directory/search`
- Type "kosher" → dropdown shows businesses
- Click suggestion → goes to business page
- Press Enter → does full page search with results grid
- Category/city filters still work alongside

- [ ] **Step 3: Commit**

```bash
git add src/app/directory/search/page.tsx
git commit -m "feat: upgrade directory search with fuzzy dropdown"
```

---

### Task 10: Upgrade Classifieds search

**Files:**
- Modify: `src/components/classifieds/ClassifiedsBrowser.tsx`

Replace the basic search input with `<UniversalSearch>`.

- [ ] **Step 1: Replace search input with UniversalSearch**

Import `UniversalSearch`. Replace the existing search form (around lines 75-80) with:

```tsx
<UniversalSearch
  searchType="classifieds"
  placeholder="Search classifieds..."
  initialQuery={currentSearch}
  onSearch={(q) => {
    router.push(`/classifieds?q=${encodeURIComponent(q)}`);
  }}
  className="max-w-xl"
/>
```

- [ ] **Step 2: Test manually**

- Visit `/classifieds`
- Type a search term → dropdown shows matching classifieds
- Click suggestion → goes to classified detail page
- Enter → does full page search
- Category filter alongside works

- [ ] **Step 3: Commit**

```bash
git add src/components/classifieds/ClassifiedsBrowser.tsx
git commit -m "feat: upgrade classifieds search with fuzzy dropdown"
```

---

## Chunk 5: Refactor existing fuzzy search pages + cleanup

### Task 11: Refactor Ask the Rabbi to use UniversalSearch

**Files:**
- Modify: `src/app/ask-the-rabbi/page.tsx`
- Remove: `src/components/ask-the-rabbi/AskTheRabbiSearch.tsx` (after verified working)

- [ ] **Step 1: Replace AskTheRabbiSearch with UniversalSearch**

In `src/app/ask-the-rabbi/page.tsx`, replace:
```tsx
import { AskTheRabbiSearch } from "@/components/ask-the-rabbi/AskTheRabbiSearch";
```
with:
```tsx
import { UniversalSearch } from "@/components/search/UniversalSearch";
```

Replace the `<AskTheRabbiSearch initialQuery={query} />` usage with:
```tsx
<UniversalSearch
  searchType="ask-the-rabbi"
  placeholder="Search questions..."
  initialQuery={query}
  onSearch={(q) => {
    router.push(`/ask-the-rabbi?q=${encodeURIComponent(q)}`);
  }}
  className="max-w-2xl"
/>
```

Note: The page may need `useRouter` imported if not already. Check whether `router` is already available from the existing page logic. If the page is a server component, wrap the search in a client component or convert the relevant section.

- [ ] **Step 2: Test manually**

- Visit `/ask-the-rabbi`
- Type "purim" → dropdown shows matching questions with `#number` subtitle
- Click suggestion → goes to `/ask-the-rabbi/[id]`
- Press Enter → full page search with results
- Compare behavior with old version — should feel the same

- [ ] **Step 3: Delete old component**

```bash
rm src/components/ask-the-rabbi/AskTheRabbiSearch.tsx
```

Verify no other file imports `AskTheRabbiSearch`:
```bash
grep -r "AskTheRabbiSearch" src/
```

Expected: No results (or only the file we just deleted).

- [ ] **Step 4: Commit**

```bash
git add src/app/ask-the-rabbi/page.tsx
git rm src/components/ask-the-rabbi/AskTheRabbiSearch.tsx
git commit -m "refactor: replace AskTheRabbiSearch with UniversalSearch"
```

---

### Task 12: Refactor Homepage hero search to use UniversalSearch

**Files:**
- Modify: `src/components/home/HeroSection.tsx`

The HeroSection has ~60 lines of inline search logic (state, debounce, dropdown rendering). Replace all of it with `<UniversalSearch>`.

- [ ] **Step 1: Replace inline search with UniversalSearch**

Import `UniversalSearch`. Remove the following state/logic from HeroSection:
- `searchQuery`, `searchResults`, `isSearching`, `showDropdown` states
- `searchDebounceRef`
- The `useEffect` that fetches `/api/search`
- The search results dropdown rendering

Replace with:
```tsx
<UniversalSearch
  searchType="all"
  placeholder="Search businesses, events, and more..."
  onSearch={(q) => {
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }}
  className="max-w-2xl mx-auto"
/>
```

- [ ] **Step 2: Test manually**

- Visit homepage
- Type in search → dropdown shows results from all types with type badges
- Click suggestion → goes to correct detail page
- Press Enter → goes to `/search?q=...`

- [ ] **Step 3: Commit**

```bash
git add src/components/home/HeroSection.tsx
git commit -m "refactor: replace inline homepage search with UniversalSearch"
```

---

### Task 13: Update `/search` results page to use new API

**Files:**
- Modify: `src/app/(public)/search/page.tsx`

The search results page currently calls `/api/search` and reads `data.results`. Update it to call `/api/search/suggestions?type=all` and read `data.suggestions`.

- [ ] **Step 1: Update the search results page**

In `src/app/(public)/search/page.tsx`:

1. Update the `SearchResult` interface to match `SearchSuggestion` shape (id is string, type includes all types, add `subtitle`, `url`).
2. Update `performSearch` to call `/api/search/suggestions?type=all&q=...&limit=20`.
3. Update result rendering to use `suggestion.url` for links and `suggestion.subtitle` for secondary text.
4. Update `typeConfig` to include all 6 content types with appropriate icons and colors.
5. Add `UniversalSearch` component in the header to replace the basic Input.

- [ ] **Step 2: Test manually**

- Visit `/search?q=torah`
- Results should show from all content types
- Type badges for all 6 types appear correctly
- Load more still works
- Search input in header works

- [ ] **Step 3: Commit**

```bash
git add src/app/(public)/search/page.tsx
git commit -m "refactor: update search results page to use unified suggestions API"
```

---

### Task 14: Remove old API endpoints

**Files:**
- Remove: `src/app/api/ask-the-rabbi/search/route.ts`
- Remove: `src/app/api/search/route.ts`
- Remove: `src/components/directory/DirectorySearch.tsx`

- [ ] **Step 1: Verify nothing else uses these endpoints**

```bash
grep -r "api/ask-the-rabbi/search" src/ --include="*.ts" --include="*.tsx"
grep -r '"/api/search"' src/ --include="*.ts" --include="*.tsx"
grep -r "api/search?" src/ --include="*.ts" --include="*.tsx"
grep -r "DirectorySearch" src/ --include="*.ts" --include="*.tsx"
```

Expected: Only the files we're about to delete (or already updated files).

If any file still references these, update it first before deleting.

- [ ] **Step 2: Delete old files**

```bash
rm src/app/api/ask-the-rabbi/search/route.ts
rm src/app/api/search/route.ts
rm src/components/directory/DirectorySearch.tsx
```

- [ ] **Step 3: Commit**

```bash
git rm src/app/api/ask-the-rabbi/search/route.ts
git rm src/app/api/search/route.ts
git rm src/components/directory/DirectorySearch.tsx
git commit -m "chore: remove old search endpoints and components replaced by UniversalSearch"
```

---

### Task 15: Final integration test

- [ ] **Step 1: Test every search across the site**

Visit each page and verify the search works:

1. **Homepage** (`/`) — type in hero search → dropdown with all types → Enter goes to `/search`
2. **`/search?q=test`** — results page shows results from all types
3. **`/ask-the-rabbi`** — type → dropdown with questions → click goes to detail
4. **`/shuls`** — type → dropdown → click goes to shul page → Enter filters list → filters work alongside
5. **`/shiurim`** — type → dropdown → click goes to shiur → Enter filters → filters work alongside
6. **`/community/calendar`** — type → dropdown → click goes to event → Enter filters → event type filter works alongside
7. **`/directory/search`** — type → dropdown → click goes to business → Enter does full search → city/category filters work
8. **`/classifieds`** — type → dropdown → click goes to classified → Enter searches → category filter works

For each, verify:
- Dropdown appears after 2 chars (3 for homepage)
- Keyboard navigation (up/down/enter/escape)
- Click outside closes dropdown
- Clear button works
- No console errors

- [ ] **Step 2: Commit any fixes**

If any fixes were needed, commit them.

- [ ] **Step 3: Update CLAUDE.md with session notes**

Add session notes documenting the universal search system.
