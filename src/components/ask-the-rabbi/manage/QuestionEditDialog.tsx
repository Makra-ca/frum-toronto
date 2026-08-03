"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Question } from "./types";

// ─── Edit Dialog ──────────────────────────────────────────────────────────────

interface EditDialogProps {
  question: Question | null;
  onClose: () => void;
  onSaved: (updated: Question) => void;
}

export function QuestionEditDialog({ question, onClose, onSaved }: EditDialogProps) {
  const [title, setTitle] = useState(question?.title || "");
  const [questionText, setQuestionText] = useState(question?.question || "");
  const [answer, setAnswer] = useState(question?.answer || "");
  const [answeredBy, setAnsweredBy] = useState(question?.answeredBy || "");
  const [publishedAt, setPublishedAt] = useState(
    question?.publishedAt ? question.publishedAt.slice(0, 10) : ""
  );
  const [isPublished, setIsPublished] = useState(question?.isPublished ?? false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (question) {
      setTitle(question.title);
      setQuestionText(question.question);
      setAnswer(question.answer || "");
      setAnsweredBy(question.answeredBy || "");
      setPublishedAt(question.publishedAt ? question.publishedAt.slice(0, 10) : "");
      setIsPublished(question.isPublished);
    }
  }, [question]);

  const handleSave = async () => {
    if (!question) return;
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/ask-the-rabbi?id=${question.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          question: questionText.trim(),
          answer: answer.trim() || null,
          answeredBy: answeredBy.trim() || null,
          isPublished,
          publishedAt: publishedAt || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      toast.success("Question updated");
      onSaved({ ...question, ...data });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={!!question} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Question</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-question">Question</Label>
            <Textarea
              id="edit-question"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={4}
              className="resize-y"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-answer">Answer</Label>
            <Textarea
              id="edit-answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={6}
              className="resize-y"
              placeholder="Enter the Rabbi's answer..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-answered-by">Answered By</Label>
            <Input
              id="edit-answered-by"
              value={answeredBy}
              onChange={(e) => setAnsweredBy(e.target.value)}
              placeholder="Hagaon Rav Shlomo Miller Shlit'a"
            />
          </div>

          <div className="flex items-end gap-4">
            <div className="space-y-1.5 flex-1 max-w-[200px]">
              <Label htmlFor="edit-published-at">Published At</Label>
              <Input
                id="edit-published-at"
                type="date"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 pb-0.5">
              <input
                id="edit-is-published"
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="edit-is-published" className="cursor-pointer">
                Published (visible to public)
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
