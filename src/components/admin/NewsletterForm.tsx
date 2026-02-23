"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { NewsletterEditor } from "@/components/newsletter";
import { newsletterSchema, type NewsletterFormData } from "@/lib/validations/newsletter";
import { toast } from "sonner";
import { Save, Send, Clock, ArrowLeft } from "lucide-react";
import type { Newsletter, NewsletterSegment } from "@/types/newsletter";
import Link from "next/link";

interface NewsletterFormProps {
  newsletter?: Newsletter;
  isNew?: boolean;
}

interface SegmentWithCount extends NewsletterSegment {
  subscriberCount: number;
}

export function NewsletterForm({ newsletter, isNew = false }: NewsletterFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [segments, setSegments] = useState<SegmentWithCount[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>("");
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<NewsletterFormData>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: {
      title: newsletter?.title || "",
      subject: newsletter?.subject || "",
      previewText: newsletter?.previewText || "",
      content: newsletter?.content || "",
      contentJson: newsletter?.contentJson || null,
      status: newsletter?.status || "draft",
    },
  });

  const content = watch("content");
  const title = watch("title");

  useEffect(() => {
    fetchSegments();
  }, []);

  const fetchSegments = async () => {
    try {
      const res = await fetch("/api/admin/newsletter-segments");
      if (res.ok) {
        const data = await res.json();
        setSegments(data);
        // Select default segment if available
        const defaultSegment = data.find((s: SegmentWithCount) => s.isDefault);
        if (defaultSegment) {
          setSelectedSegmentId(defaultSegment.id.toString());
        }
      }
    } catch (error) {
      console.error("Failed to fetch segments:", error);
    }
  };

  const handleEditorChange = (html: string, json: unknown) => {
    setValue("content", html, { shouldDirty: true });
    setValue("contentJson", json, { shouldDirty: true });
  };

  const onSubmit = async (data: NewsletterFormData) => {
    setIsLoading(true);
    try {
      const url = isNew
        ? "/api/admin/newsletters"
        : `/api/admin/newsletters/${newsletter?.id}`;

      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save");
      }

      const saved = await res.json();
      toast.success(isNew ? "Newsletter created" : "Newsletter saved");

      if (isNew) {
        router.push(`/admin/newsletters/${saved.id}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save newsletter");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newsletter?.id) return;

    setIsSending(true);
    try {
      // Save first if dirty
      if (isDirty) {
        await handleSubmit(onSubmit)();
      }

      const res = await fetch(`/api/admin/newsletters/${newsletter.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segmentId: selectedSegmentId ? parseInt(selectedSegmentId) : null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to send");
      }

      const result = await res.json();
      toast.success(`Newsletter sending to ${result.totalRecipients} recipients`);
      setShowSendDialog(false);
      router.push("/admin/newsletters");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send newsletter");
    } finally {
      setIsSending(false);
    }
  };

  const handleSchedule = async () => {
    if (!newsletter?.id || !scheduleDate || !scheduleTime) return;

    setIsSending(true);
    try {
      // Save first if dirty
      if (isDirty) {
        await handleSubmit(onSubmit)();
      }

      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();

      const res = await fetch(`/api/admin/newsletters/${newsletter.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segmentId: selectedSegmentId ? parseInt(selectedSegmentId) : null,
          scheduleAt: scheduledAt,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to schedule");
      }

      const result = await res.json();
      toast.success(`Newsletter scheduled for ${result.totalRecipients} recipients`);
      setShowScheduleDialog(false);
      router.push("/admin/newsletters");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to schedule newsletter");
    } finally {
      setIsSending(false);
    }
  };

  const selectedSegment = segments.find((s) => s.id.toString() === selectedSegmentId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/newsletters">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isNew ? "New Newsletter" : title || "Edit Newsletter"}
            </h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleSubmit(onSubmit)}
            disabled={isLoading}
          >
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? "Saving..." : "Save Draft"}
          </Button>
          {!isNew && newsletter?.status === "draft" && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowScheduleDialog(true)}
                disabled={!content}
              >
                <Clock className="h-4 w-4 mr-2" />
                Schedule
              </Button>
              <Button
                onClick={() => setShowSendDialog(true)}
                disabled={!content}
              >
                <Send className="h-4 w-4 mr-2" />
                Send Now
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Internal Title</Label>
            <Input
              id="title"
              {...register("title")}
              placeholder="e.g., Weekly Update - Jan 2025"
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title.message}</p>
            )}
            <p className="text-xs text-gray-500">For internal reference only</p>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Email Subject Line</Label>
            <Input
              id="subject"
              {...register("subject")}
              placeholder="e.g., This Week in Toronto's Jewish Community"
            />
            {errors.subject && (
              <p className="text-sm text-red-500">{errors.subject.message}</p>
            )}
            <p className="text-xs text-gray-500">What recipients see in their inbox</p>
          </div>
        </div>

        {/* Preview Text */}
        <div className="space-y-2">
          <Label htmlFor="previewText">Preview Text (Optional)</Label>
          <Input
            id="previewText"
            {...register("previewText")}
            placeholder="Brief preview shown in email clients..."
            maxLength={200}
          />
          <p className="text-xs text-gray-500">
            Shown in email clients next to subject line (max 200 chars)
          </p>
        </div>

        {/* Editor */}
        <div className="space-y-2">
          <Label>Content</Label>
          <NewsletterEditor
            content={content}
            contentJson={newsletter?.contentJson}
            onChange={handleEditorChange}
          />
          {errors.content && (
            <p className="text-sm text-red-500">{errors.content.message}</p>
          )}
        </div>
      </form>

      {/* Send Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Newsletter</DialogTitle>
            <DialogDescription>
              Choose which subscribers should receive this newsletter.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Send To</Label>
              <Select value={selectedSegmentId} onValueChange={setSelectedSegmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="All newsletter subscribers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All newsletter subscribers</SelectItem>
                  {segments.map((segment) => (
                    <SelectItem key={segment.id} value={segment.id.toString()}>
                      {segment.name} ({segment.subscriberCount} subscribers)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedSegment && (
              <p className="text-sm text-gray-600">
                This will send to {selectedSegment.subscriberCount} subscribers.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={isSending}>
              {isSending ? "Sending..." : "Send Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Newsletter</DialogTitle>
            <DialogDescription>
              Choose when to send this newsletter.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Send To</Label>
              <Select value={selectedSegmentId} onValueChange={setSelectedSegmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="All newsletter subscribers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All newsletter subscribers</SelectItem>
                  {segments.map((segment) => (
                    <SelectItem key={segment.id} value={segment.id.toString()}>
                      {segment.name} ({segment.subscriberCount} subscribers)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scheduleDate">Date</Label>
                <Input
                  id="scheduleDate"
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduleTime">Time (EST)</Label>
                <Input
                  id="scheduleTime"
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSchedule}
              disabled={isSending || !scheduleDate || !scheduleTime}
            >
              {isSending ? "Scheduling..." : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
