"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, PenLine, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface AtrQuickPostProps {
  canManageAtr: boolean;
}

export function AtrQuickPost({ canManageAtr }: AtrQuickPostProps) {
  const { data: session } = useSession();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [publishedAt, setPublishedAt] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show for users with the permission
  if (!canManageAtr || !session?.user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (question.trim().length < 20) {
      setError("Question must be at least 20 characters.");
      return;
    }
    if (answer.trim().length < 20) {
      setError("Answer must be at least 20 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/ask-the-rabbi/quick-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          question: question.trim(),
          answer: answer.trim(),
          publishedAt: publishedAt || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to publish question");
      }

      toast.success(`Question #${data.questionNumber} published successfully`);
      setTitle("");
      setQuestion("");
      setAnswer("");
      setPublishedAt(new Date().toISOString().slice(0, 10));
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to publish question";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-2 border-indigo-200 bg-indigo-50/40 mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-indigo-900 text-base font-semibold">
          <PenLine className="h-4 w-4" />
          Quick Publish Q&amp;A
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="atr-title" className="text-sm font-medium">
              Title
            </Label>
            <Input
              id="atr-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief descriptive title for this question"
              className="bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="atr-question" className="text-sm font-medium">
              Question
            </Label>
            <Textarea
              id="atr-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="The full question text..."
              rows={3}
              className="bg-white resize-y"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="atr-answer" className="text-sm font-medium">
              Answer
            </Label>
            <Textarea
              id="atr-answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="The Rabbi's answer..."
              rows={5}
              className="bg-white resize-y"
            />
          </div>

          <div className="flex items-end gap-4">
            <div className="space-y-1.5 flex-1 max-w-[200px]">
              <Label htmlFor="atr-published-at" className="text-sm font-medium">
                Published At
              </Label>
              <Input
                id="atr-published-at"
                type="date"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="bg-white"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Publish Question
                </>
              )}
            </Button>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
