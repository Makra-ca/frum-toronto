import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { askTheRabbi } from "@/lib/db/schema";
import { desc, sql, and, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";

  if (query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    // Split query into individual words for multi-word matching
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .slice(0, 5); // Limit to 5 words max

    if (words.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    // Build conditions: each word must match (exact OR fuzzy) in title OR question
    // This ensures "purim seuda meat" finds questions containing all three words
    const wordConditions = words.map(
      (word) => sql`(
        ${askTheRabbi.title} ILIKE ${"%" + word + "%"}
        OR ${askTheRabbi.question} ILIKE ${"%" + word + "%"}
        OR word_similarity(${word}, ${askTheRabbi.title}) > 0.4
        OR word_similarity(${word}, ${askTheRabbi.question}) > 0.35
      )`
    );

    // Calculate match score for ranking:
    // - Count how many words match exactly in title (highest value)
    // - Count how many words match exactly in question
    // - Sum of fuzzy similarity scores
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

    const suggestions = await db
      .select({
        id: askTheRabbi.id,
        questionNumber: askTheRabbi.questionNumber,
        title: askTheRabbi.title,
        question: askTheRabbi.question,
      })
      .from(askTheRabbi)
      .where(and(eq(askTheRabbi.isPublished, true), ...wordConditions))
      .orderBy(
        // Primary: count of exact title matches (more = better)
        sql`(${sql.join(exactTitleMatches, sql` + `)}) DESC`,
        // Secondary: count of exact question matches
        sql`(${sql.join(exactQuestionMatches, sql` + `)}) DESC`,
        // Tertiary: sum of fuzzy similarity scores
        sql`(${sql.join(fuzzySimilarities, sql` + `)}) DESC`,
        // Finally: by question number
        desc(askTheRabbi.questionNumber)
      )
      .limit(8);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("[API] Error searching ask the rabbi:", error);
    return NextResponse.json({ suggestions: [] });
  }
}
