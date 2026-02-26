import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { businesses, classifieds, askTheRabbi, businessCategories, classifiedCategories } from "@/lib/db/schema";
import { eq, and, or, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

type SearchResultType = "business" | "classified" | "askTheRabbi";

interface SearchResult {
  id: number;
  type: SearchResultType;
  title: string;
  description: string | null;
  url: string;
  category?: string | null;
  relevanceScore: number;
}

// Minimum similarity threshold for fuzzy matches (0-1, lower = more fuzzy)
const SIMILARITY_THRESHOLD = 0.2;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() || "";
    const limit = parseInt(searchParams.get("limit") || "6");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Minimum 3 characters required
    if (query.length < 3) {
      return NextResponse.json({ results: [], total: 0 });
    }

    const searchTerm = `%${query}%`;
    const queryLower = query.toLowerCase();

    // Search businesses with fuzzy matching
    const businessResults = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        description: businesses.description,
        slug: businesses.slug,
        categoryName: businessCategories.name,
        // Calculate similarity scores
        nameSimilarity: sql<number>`GREATEST(
          similarity(LOWER(${businesses.name}), ${queryLower}),
          word_similarity(${queryLower}, LOWER(${businesses.name}))
        )`,
        descSimilarity: sql<number>`COALESCE(similarity(LOWER(${businesses.description}), ${queryLower}), 0)`,
        catSimilarity: sql<number>`COALESCE(similarity(LOWER(${businessCategories.name}), ${queryLower}), 0)`,
      })
      .from(businesses)
      .leftJoin(businessCategories, eq(businesses.categoryId, businessCategories.id))
      .where(
        and(
          eq(businesses.approvalStatus, "approved"),
          eq(businesses.isActive, true),
          or(
            // Exact/substring matches
            sql`LOWER(${businesses.name}) LIKE LOWER(${searchTerm})`,
            sql`LOWER(${businesses.description}) LIKE LOWER(${searchTerm})`,
            sql`LOWER(${businessCategories.name}) LIKE LOWER(${searchTerm})`,
            // Fuzzy matches using trigram similarity
            sql`similarity(LOWER(${businesses.name}), ${queryLower}) > ${SIMILARITY_THRESHOLD}`,
            sql`word_similarity(${queryLower}, LOWER(${businesses.name})) > ${SIMILARITY_THRESHOLD}`,
            sql`similarity(LOWER(${businesses.description}), ${queryLower}) > ${SIMILARITY_THRESHOLD}`,
            sql`similarity(LOWER(${businessCategories.name}), ${queryLower}) > ${SIMILARITY_THRESHOLD}`
          )
        )
      )
      .limit(30);

    // Search classifieds with fuzzy matching
    const classifiedResults = await db
      .select({
        id: classifieds.id,
        title: classifieds.title,
        description: classifieds.description,
        categoryName: classifiedCategories.name,
        titleSimilarity: sql<number>`GREATEST(
          similarity(LOWER(${classifieds.title}), ${queryLower}),
          word_similarity(${queryLower}, LOWER(${classifieds.title}))
        )`,
        descSimilarity: sql<number>`COALESCE(similarity(LOWER(${classifieds.description}), ${queryLower}), 0)`,
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
            sql`similarity(LOWER(${classifieds.title}), ${queryLower}) > ${SIMILARITY_THRESHOLD}`,
            sql`word_similarity(${queryLower}, LOWER(${classifieds.title})) > ${SIMILARITY_THRESHOLD}`,
            sql`similarity(LOWER(${classifieds.description}), ${queryLower}) > ${SIMILARITY_THRESHOLD}`,
            sql`similarity(LOWER(${classifiedCategories.name}), ${queryLower}) > ${SIMILARITY_THRESHOLD}`
          )
        )
      )
      .limit(30);

    // Search Ask the Rabbi with fuzzy matching (includes answer field)
    const askRabbiResults = await db
      .select({
        id: askTheRabbi.id,
        questionNumber: askTheRabbi.questionNumber,
        title: askTheRabbi.title,
        question: askTheRabbi.question,
        answer: askTheRabbi.answer,
        category: askTheRabbi.category,
        titleSimilarity: sql<number>`GREATEST(
          similarity(LOWER(${askTheRabbi.title}), ${queryLower}),
          word_similarity(${queryLower}, LOWER(${askTheRabbi.title}))
        )`,
        questionSimilarity: sql<number>`COALESCE(similarity(LOWER(${askTheRabbi.question}), ${queryLower}), 0)`,
        answerSimilarity: sql<number>`COALESCE(similarity(LOWER(${askTheRabbi.answer}), ${queryLower}), 0)`,
      })
      .from(askTheRabbi)
      .where(
        and(
          eq(askTheRabbi.isPublished, true),
          or(
            sql`LOWER(${askTheRabbi.title}) LIKE LOWER(${searchTerm})`,
            sql`LOWER(${askTheRabbi.question}) LIKE LOWER(${searchTerm})`,
            sql`LOWER(${askTheRabbi.answer}) LIKE LOWER(${searchTerm})`,
            sql`similarity(LOWER(${askTheRabbi.title}), ${queryLower}) > ${SIMILARITY_THRESHOLD}`,
            sql`word_similarity(${queryLower}, LOWER(${askTheRabbi.title})) > ${SIMILARITY_THRESHOLD}`,
            sql`similarity(LOWER(${askTheRabbi.question}), ${queryLower}) > ${SIMILARITY_THRESHOLD}`,
            sql`similarity(LOWER(${askTheRabbi.answer}), ${queryLower}) > ${SIMILARITY_THRESHOLD}`
          )
        )
      )
      .limit(30);

    // Calculate combined relevance scores
    const allResults: SearchResult[] = [];

    // Process business results
    for (const b of businessResults) {
      const nameLower = b.name.toLowerCase();
      const descLower = (b.description || "").toLowerCase();
      const catLower = (b.categoryName || "").toLowerCase();

      // Calculate score based on match type and similarity
      let score = 0;

      // Exact match bonuses (highest priority)
      if (nameLower === queryLower) score += 150;
      else if (nameLower.startsWith(queryLower)) score += 120;
      else if (nameLower.includes(queryLower)) score += 100;

      // Category exact matches
      if (catLower === queryLower) score += 80;
      else if (catLower.includes(queryLower)) score += 50;

      // Description matches
      if (descLower.includes(queryLower)) score += 30;

      // Add fuzzy similarity scores (scaled 0-100)
      score += (Number(b.nameSimilarity) || 0) * 80;
      score += (Number(b.catSimilarity) || 0) * 40;
      score += (Number(b.descSimilarity) || 0) * 20;

      allResults.push({
        id: b.id,
        type: "business",
        title: b.name,
        description: b.description ? (b.description.length > 150 ? b.description.slice(0, 150) + "..." : b.description) : null,
        url: `/directory/business/${b.slug}`,
        category: b.categoryName,
        relevanceScore: score,
      });
    }

    // Process classified results
    for (const c of classifiedResults) {
      const titleLower = c.title.toLowerCase();
      const descLower = (c.description || "").toLowerCase();
      const catLower = (c.categoryName || "").toLowerCase();

      let score = 0;

      if (titleLower === queryLower) score += 150;
      else if (titleLower.startsWith(queryLower)) score += 120;
      else if (titleLower.includes(queryLower)) score += 100;

      if (catLower === queryLower) score += 80;
      else if (catLower.includes(queryLower)) score += 50;

      if (descLower.includes(queryLower)) score += 30;

      score += (Number(c.titleSimilarity) || 0) * 80;
      score += (Number(c.catSimilarity) || 0) * 40;
      score += (Number(c.descSimilarity) || 0) * 20;

      allResults.push({
        id: c.id,
        type: "classified",
        title: c.title,
        description: c.description ? (c.description.length > 150 ? c.description.slice(0, 150) + "..." : c.description) : null,
        url: `/classifieds/${c.id}`,
        category: c.categoryName,
        relevanceScore: score,
      });
    }

    // Process Ask the Rabbi results
    for (const a of askRabbiResults) {
      const titleLower = a.title.toLowerCase();
      const questionLower = (a.question || "").toLowerCase();
      const answerLower = (a.answer || "").toLowerCase();

      let score = 0;

      if (titleLower === queryLower) score += 150;
      else if (titleLower.startsWith(queryLower)) score += 120;
      else if (titleLower.includes(queryLower)) score += 100;

      if (questionLower.includes(queryLower)) score += 40;
      if (answerLower.includes(queryLower)) score += 30;

      score += (Number(a.titleSimilarity) || 0) * 80;
      score += (Number(a.questionSimilarity) || 0) * 40;
      score += (Number(a.answerSimilarity) || 0) * 30;

      allResults.push({
        id: a.id,
        type: "askTheRabbi",
        title: a.questionNumber ? `#${a.questionNumber}: ${a.title}` : a.title,
        description: a.question ? (a.question.length > 150 ? a.question.slice(0, 150) + "..." : a.question) : null,
        url: `/ask-the-rabbi/${a.id}`,
        category: a.category,
        relevanceScore: score,
      });
    }

    // Sort by relevance score (highest first)
    allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Get total count before pagination
    const total = allResults.length;

    // Apply pagination
    const paginatedResults = allResults.slice(offset, offset + limit);

    return NextResponse.json({
      results: paginatedResults,
      total,
      query,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("[API] Search error:", error);
    return NextResponse.json(
      { error: "Failed to search" },
      { status: 500 }
    );
  }
}
