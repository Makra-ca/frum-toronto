import Link from "next/link";
import { db } from "@/lib/db";
import { askTheRabbi } from "@/lib/db/schema";
import { desc, sql, and, eq, isNotNull } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, MessageSquare, ChevronRight } from "lucide-react";

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

  const conditions = [
    eq(askTheRabbi.isPublished, true),
  ];

  if (query) {
    conditions.push(
      sql`(${askTheRabbi.title} ILIKE ${"%" + query + "%"} OR ${askTheRabbi.question} ILIKE ${"%" + query + "%"})`
    );
  }

  const questions = await db
    .select({
      id: askTheRabbi.id,
      questionNumber: askTheRabbi.questionNumber,
      title: askTheRabbi.title,
      question: askTheRabbi.question,
      publishedAt: askTheRabbi.publishedAt,
    })
    .from(askTheRabbi)
    .where(and(...conditions))
    .orderBy(desc(askTheRabbi.questionNumber))
    .limit(pageSize)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(askTheRabbi)
    .where(and(...conditions));

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
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare className="h-8 w-8" />
            <h1 className="text-3xl md:text-4xl font-bold">Ask The Rabbi</h1>
          </div>
          <p className="text-purple-200 text-lg mb-2">
            Halachic questions answered by Hagaon Rav Shlomo Miller Shlit&apos;a
          </p>
          <p className="text-purple-300">
            {totalCount.toLocaleString()} questions and answers
          </p>

          {/* Search */}
          <div className="max-w-2xl mt-8">
            <form className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="search"
                  name="q"
                  defaultValue={query}
                  placeholder="Search questions..."
                  className="pl-12 h-14 bg-white text-gray-900 border-0 text-base rounded-xl"
                />
              </div>
              <Button type="submit" size="lg" className="h-14 px-8 rounded-xl bg-purple-600 hover:bg-purple-700">
                Search
              </Button>
            </form>
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
