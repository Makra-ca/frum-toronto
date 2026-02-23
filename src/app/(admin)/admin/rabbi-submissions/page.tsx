"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MessageSquare,
  Loader2,
  Eye,
  Check,
  X,
  Mail,
  User,
  Calendar,
  Image as ImageIcon,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Submission {
  id: number;
  userId: number | null;
  name: string;
  email: string;
  question: string;
  imageUrl: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

interface Counts {
  all: number;
  pending: number;
  answered: number;
  rejected: number;
}

export default function RabbiSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [counts, setCounts] = useState<Counts>({ all: 0, pending: 0, answered: 0, rejected: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");

  // Answer dialog state
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [isAnswerDialogOpen, setIsAnswerDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [editedQuestion, setEditedQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [answeredBy, setAnsweredBy] = useState("Hagaon Rav Shlomo Miller Shlit'a");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  useEffect(() => {
    fetchSubmissions();
  }, [activeTab]);

  const fetchSubmissions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/rabbi-submissions?status=${activeTab}`);
      const data = await res.json();
      setSubmissions(data.submissions || []);
      setCounts(data.counts || { all: 0, pending: 0, answered: 0, rejected: 0 });
    } catch (error) {
      console.error("Error fetching submissions:", error);
      toast.error("Failed to load submissions");
    } finally {
      setIsLoading(false);
    }
  };

  const generateTitle = (question: string): string => {
    // Take first 50 chars or first sentence, whichever is shorter
    const firstSentence = question.split(/[.?!]/)[0];
    const title = firstSentence.length > 50 ? question.substring(0, 50) : firstSentence;
    return title.trim() + (title.length < question.length ? "?" : "");
  };

  const openAnswerDialog = (submission: Submission) => {
    setSelectedSubmission(submission);
    setTitle(generateTitle(submission.question));
    setEditedQuestion(submission.question);
    setAnswer("");
    setAnsweredBy("Hagaon Rav Shlomo Miller Shlit'a");
    setImageUrl(submission.imageUrl);
    setIsAnswerDialogOpen(true);
  };

  const handlePublish = async () => {
    if (!selectedSubmission) return;

    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (!answer.trim()) {
      toast.error("Please enter an answer");
      return;
    }

    setIsPublishing(true);
    try {
      const res = await fetch("/api/admin/rabbi-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: selectedSubmission.id,
          title: title.trim(),
          question: editedQuestion.trim(),
          answer: answer.trim(),
          answeredBy: answeredBy.trim() || undefined,
          imageUrl: imageUrl || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to publish");
      }

      toast.success(`Published as question #${data.questionNumber}`);
      setIsAnswerDialogOpen(false);
      fetchSubmissions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to publish");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleReject = async (submission: Submission) => {
    if (!confirm("Are you sure you want to reject this submission?")) return;

    setIsRejecting(true);
    try {
      const res = await fetch(`/api/admin/rabbi-submissions/${submission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });

      if (!res.ok) {
        throw new Error("Failed to reject");
      }

      toast.success("Submission rejected");
      fetchSubmissions();
    } catch (error) {
      toast.error("Failed to reject submission");
    } finally {
      setIsRejecting(false);
    }
  };

  const handleDelete = async (submission: Submission) => {
    if (!confirm("Are you sure you want to permanently delete this submission?")) return;

    try {
      const res = await fetch(`/api/admin/rabbi-submissions/${submission.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete");
      }

      toast.success("Submission deleted");
      fetchSubmissions();
    } catch (error) {
      toast.error("Failed to delete submission");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "answered":
        return <Badge className="bg-green-100 text-green-800">Answered</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-8 w-8 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold">Rabbi Question Submissions</h1>
            <p className="text-gray-500">Review and answer submitted questions</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            Pending
            {counts.pending > 0 && (
              <Badge variant="secondary" className="ml-1">{counts.pending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="answered">
            Answered
            <Badge variant="secondary" className="ml-1">{counts.answered}</Badge>
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected
            <Badge variant="secondary" className="ml-1">{counts.rejected}</Badge>
          </TabsTrigger>
          <TabsTrigger value="all">
            All
            <Badge variant="secondary" className="ml-1">{counts.all}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Submissions List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : submissions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No {activeTab === "all" ? "" : activeTab} submissions found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {submissions.map((submission) => (
            <Card key={submission.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Header row */}
                    <div className="flex items-center gap-3 mb-3">
                      {getStatusBadge(submission.status)}
                      <span className="text-sm text-gray-500">
                        #{submission.id}
                      </span>
                      <span className="text-sm text-gray-400">
                        {formatDistanceToNow(new Date(submission.createdAt), { addSuffix: true })}
                      </span>
                    </div>

                    {/* Submitter info */}
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {submission.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        {submission.email}
                      </span>
                      {submission.imageUrl && (
                        <a
                          href={submission.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <ImageIcon className="h-4 w-4" />
                          Image attached
                        </a>
                      )}
                    </div>

                    {/* Question preview */}
                    <p className="text-gray-700 line-clamp-3">
                      {submission.question}
                    </p>

                    {/* Admin notes */}
                    {submission.adminNotes && (
                      <p className="text-sm text-gray-500 mt-2 italic">
                        Note: {submission.adminNotes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    {submission.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => openAnswerDialog(submission)}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Answer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(submission)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                    {submission.status !== "pending" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openAnswerDialog(submission)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(submission)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Answer Dialog */}
      <Dialog open={isAnswerDialogOpen} onOpenChange={setIsAnswerDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedSubmission?.status === "pending" ? "Answer Question" : "View Submission"}
            </DialogTitle>
            <DialogDescription>
              {selectedSubmission?.status === "pending"
                ? "Review, edit if needed, and provide an answer to publish"
                : "View submission details"}
            </DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <div className="space-y-4 py-4">
              {/* Submitter Info */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <User className="h-4 w-4 text-gray-500" />
                    {selectedSubmission.name}
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4 text-gray-500" />
                    {selectedSubmission.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    {new Date(selectedSubmission.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Image */}
              {selectedSubmission.imageUrl && (
                <div className="space-y-2">
                  <Label>Attached Image</Label>
                  <a
                    href={selectedSubmission.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={selectedSubmission.imageUrl}
                      alt="Submission attachment"
                      className="max-h-48 rounded-lg border"
                    />
                  </a>
                </div>
              )}

              {selectedSubmission.status === "pending" ? (
                <>
                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter a title for this question"
                    />
                    <p className="text-xs text-gray-500">Auto-generated from question, edit as needed</p>
                  </div>

                  {/* Question (editable) */}
                  <div className="space-y-2">
                    <Label htmlFor="question">Question *</Label>
                    <Textarea
                      id="question"
                      value={editedQuestion}
                      onChange={(e) => setEditedQuestion(e.target.value)}
                      rows={4}
                      className="resize-none"
                    />
                    <p className="text-xs text-gray-500">You can edit the question for clarity</p>
                  </div>

                  {/* Answer */}
                  <div className="space-y-2">
                    <Label htmlFor="answer">Answer *</Label>
                    <Textarea
                      id="answer"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      rows={6}
                      placeholder="Enter the Rabbi's answer..."
                      className="resize-none"
                    />
                  </div>

                  {/* Answered By */}
                  <div className="space-y-2">
                    <Label htmlFor="answeredBy">Answered By</Label>
                    <Input
                      id="answeredBy"
                      value={answeredBy}
                      onChange={(e) => setAnsweredBy(e.target.value)}
                      placeholder="Enter who answered this question"
                    />
                    <p className="text-xs text-gray-500">
                      Leave blank for default: "Hagaon Rav Shlomo Miller Shlit'a"
                    </p>
                  </div>

                  {/* Image Toggle */}
                  {selectedSubmission.imageUrl && (
                    <div className="space-y-2">
                      <Label>Include Image in Published Question</Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="includeImage"
                          checked={imageUrl !== null}
                          onChange={(e) => setImageUrl(e.target.checked ? selectedSubmission.imageUrl : null)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <label htmlFor="includeImage" className="text-sm text-gray-600">
                          Include the attached image when publishing
                        </label>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Read-only view */}
                  <div className="space-y-2">
                    <Label>Question</Label>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="whitespace-pre-wrap">{selectedSubmission.question}</p>
                    </div>
                  </div>

                  {selectedSubmission.adminNotes && (
                    <div className="space-y-2">
                      <Label>Admin Notes</Label>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm">{selectedSubmission.adminNotes}</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAnswerDialogOpen(false)}>
              Cancel
            </Button>
            {selectedSubmission?.status === "pending" && (
              <Button
                onClick={handlePublish}
                disabled={isPublishing}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Publish Answer
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
