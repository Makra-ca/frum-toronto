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
    youth: "Youth",
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
    // Index-based scoring since results are already ranked by SQL ORDER BY
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
