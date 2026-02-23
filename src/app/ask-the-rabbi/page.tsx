import Link from "next/link";
import { db } from "@/lib/db";
import { askTheRabbi } from "@/lib/db/schema";
import { desc, sql, and, eq } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, ChevronRight } from "lucide-react";
import { AskTheRabbiSearch } from "@/components/ask-the-rabbi/AskTheRabbiSearch";
import { SubmitQuestionModal } from "@/components/ask-the-rabbi/SubmitQuestionModal";

export const metadata = {
  title: "Ask The Rabbi - FrumToronto",
  description: "Browse thousands of halachic questions answered by Hagaon Rav Shlomo Miller Shlit'a",
};

interface SearchParams {
  page?: string;
  q?: string;
}

async function getQuestions(searchParams: SearchParams) {
  const page = parseInt(searchParams.page || "1");
  const query = searchParams.q || "";
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  // Split query into individual words for multi-word matching
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, 5);

  const baseConditions = [eq(askTheRabbi.isPublished, true)];

  // Build word-based conditions if searching
  let wordConditions: ReturnType<typeof sql>[] = [];
  if (words.length > 0) {
    wordConditions = words.map(
      (word) => sql`(
        ${askTheRabbi.title} ILIKE ${"%" + word + "%"}
        OR ${askTheRabbi.question} ILIKE ${"%" + word + "%"}
        OR word_similarity(${word}, ${askTheRabbi.title}) > 0.4
        OR word_similarity(${word}, ${askTheRabbi.question}) > 0.35
      )`
    );
  }

  const allConditions = [...baseConditions, ...wordConditions];

  // Build ranking expressions for multi-word search
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

  const questions = await db
    .select({
      id: askTheRabbi.id,
      questionNumber: askTheRabbi.questionNumber,
      title: askTheRabbi.title,
      question: askTheRabbi.question,
      publishedAt: askTheRabbi.publishedAt,
    })
    .from(askTheRabbi)
    .where(and(...allConditions))
    .orderBy(
      // When searching, order by relevance; otherwise by question number
      words.length > 0
        ? sql`(${sql.join(exactTitleMatches, sql` + `)}) DESC`
        : sql`1`,
      words.length > 0
        ? sql`(${sql.join(exactQuestionMatches, sql` + `)}) DESC`
        : sql`1`,
      words.length > 0
        ? sql`(${sql.join(fuzzySimilarities, sql` + `)}) DESC`
        : sql`1`,
      desc(askTheRabbi.questionNumber)
    )
    .limit(pageSize)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(askTheRabbi)
    .where(and(...allConditions));

  const totalCount = Number(countResult[0]?.count) || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return { questions, totalCount, totalPages, page };
}

export default async function AskTheRabbiPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { questions, totalCount, totalPages, page } = await getQuestions(params);
  const query = params.q || "";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-8 w-8" />
              <h1 className="text-3xl md:text-4xl font-bold">Ask The Rabbi</h1>
            </div>
            <SubmitQuestionModal />
          </div>
          <p className="text-purple-200 text-lg mb-2">
            Halachic questions answered by Hagaon Rav Shlomo Miller Shlit&apos;a
          </p>
          <p className="text-purple-300">
            {totalCount.toLocaleString()} questions and answers
          </p>

          {/* Search */}
          <div className="mt-8">
            <AskTheRabbiSearch initialQuery={query} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {query && (
          <div className="mb-6">
            <p className="text-gray-600">
              Showing results for &quot;{query}&quot;
              <Link href="/ask-the-rabbi" className="text-purple-600 ml-2 hover:underline">
                Clear search
              </Link>
            </p>
          </div>
        )}

        {/* Questions List */}
        <div className="space-y-4">
          {questions.map((q) => (
            <Link key={q.id} href={`/ask-the-rabbi/${q.id}`}>
              <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {q.questionNumber && (
                          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                            #{q.questionNumber}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900 text-lg mb-2">
                        {q.title}
                      </h3>
                      <p className="text-gray-600 text-sm line-clamp-2">
                        {q.question?.substring(0, 200)}...
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {questions.length === 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">No questions found matching your search.</p>
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-8">
            <Button
              asChild
              variant="outline"
              disabled={page <= 1}
            >
              <Link
                href={`/ask-the-rabbi?page=${page - 1}${query ? `&q=${query}` : ""}`}
                className={page <= 1 ? "pointer-events-none opacity-50" : ""}
              >
                Previous
              </Link>
            </Button>
            <span className="px-4 text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <Button
              asChild
              variant="outline"
              disabled={page >= totalPages}
            >
              <Link
                href={`/ask-the-rabbi?page=${page + 1}${query ? `&q=${query}` : ""}`}
                className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
              >
                Next
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
