import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { askTheRabbi } from "@/lib/db/schema";
import { eq, desc, lt, gt } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronLeft, ChevronRight, MessageSquare, User } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const question = await db
    .select({ title: askTheRabbi.title, questionNumber: askTheRabbi.questionNumber })
    .from(askTheRabbi)
    .where(eq(askTheRabbi.id, parseInt(id)))
    .limit(1);

  if (!question[0]) {
    return { title: "Question Not Found" };
  }

  return {
    title: `${question[0].title} - Ask The Rabbi`,
    description: `Question #${question[0].questionNumber} answered by Hagaon Rav Shlomo Miller Shlit'a`,
  };
}

async function getQuestion(id: number) {
  const result = await db
    .select()
    .from(askTheRabbi)
    .where(eq(askTheRabbi.id, id))
    .limit(1);

  if (!result[0]) return null;

  // Get previous and next questions
  const [prevQuestion] = await db
    .select({ id: askTheRabbi.id, questionNumber: askTheRabbi.questionNumber })
    .from(askTheRabbi)
    .where(gt(askTheRabbi.questionNumber, result[0].questionNumber || 0))
    .orderBy(askTheRabbi.questionNumber)
    .limit(1);

  const [nextQuestion] = await db
    .select({ id: askTheRabbi.id, questionNumber: askTheRabbi.questionNumber })
    .from(askTheRabbi)
    .where(lt(askTheRabbi.questionNumber, result[0].questionNumber || 0))
    .orderBy(desc(askTheRabbi.questionNumber))
    .limit(1);

  return {
    question: result[0],
    prevId: prevQuestion?.id,
    nextId: nextQuestion?.id,
  };
}

export default async function QuestionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getQuestion(parseInt(id));

  if (!data) {
    notFound();
  }

  const { question, prevId, nextId } = data;

  // Format the question and answer text with proper paragraphs
  const formatText = (text: string | null) => {
    if (!text) return null;
    return text.split(/\n+/).filter(p => p.trim()).map((paragraph, i) => (
      <p key={i} className="mb-4 last:mb-0">
        {paragraph}
      </p>
    ));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 text-white py-8">
        <div className="container mx-auto px-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-purple-200 mb-4">
            <Link href="/ask-the-rabbi" className="hover:text-white">
              Ask The Rabbi
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-white">#{question.questionNumber}</span>
          </nav>

          <div className="flex items-center gap-3">
            <MessageSquare className="h-7 w-7" />
            <h1 className="text-2xl md:text-3xl font-bold">{question.title}</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Question Number Badge */}
          <div className="mb-6">
            {question.questionNumber && (
              <Badge className="bg-purple-100 text-purple-800 text-sm px-3 py-1">
                Question #{question.questionNumber}
              </Badge>
            )}
          </div>

          {/* Question */}
          <Card className="border-0 shadow-md mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-purple-600 font-semibold mb-4">
                <MessageSquare className="h-5 w-5" />
                Question
              </div>
              <div className="text-gray-700 leading-relaxed">
                {formatText(question.question)}
              </div>
            </CardContent>
          </Card>

          {/* Answer */}
          {question.answer && (
            <Card className="border-0 shadow-md mb-6 bg-purple-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-purple-600 font-semibold mb-4">
                  <User className="h-5 w-5" />
                  Answer
                </div>
                <div className="text-gray-700 leading-relaxed">
                  {formatText(question.answer)}
                </div>
                <div className="mt-6 pt-4 border-t border-purple-200">
                  <p className="text-sm text-gray-600">
                    Answered by: <span className="font-medium">{question.answeredBy}</span>
                  </p>
                  {question.publishedAt && (
                    <p className="text-sm text-gray-500 mt-1">
                      Published: {new Date(question.publishedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <div>
              {prevId && (
                <Button asChild variant="outline">
                  <Link href={`/ask-the-rabbi/${prevId}`}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous Question
                  </Link>
                </Button>
              )}
            </div>
            <Button asChild variant="ghost">
              <Link href="/ask-the-rabbi">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to All Questions
              </Link>
            </Button>
            <div>
              {nextId && (
                <Button asChild variant="outline">
                  <Link href={`/ask-the-rabbi/${nextId}`}>
                    Next Question
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
