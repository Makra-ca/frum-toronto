"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NewsletterEditor } from "@/components/newsletter";
import { NewsletterBlockSidebar } from "@/components/newsletter/NewsletterBlockSidebar";
import { NewsletterPreviewModal } from "@/components/newsletter/NewsletterPreviewModal";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { newsletterSchema, type NewsletterFormData } from "@/lib/validations/newsletter";
import { toast } from "sonner";
import {
  Save,
  Send,
  Eye,
  ArrowLeft,
  Layers,
  Users,
  Loader2,
} from "lucide-react";
import type { Newsletter } from "@/types/newsletter";
import Link from "next/link";

export default function EditNewsletterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const newsletterId = parseInt(id);

  // ─── Newsletter data ─────────────────────────────────────────────────────────
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Sidebar state ───────────────────────────────────────────────────────────
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ─── Preview state ───────────────────────────────────────────────────────────
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewGeneratedAt, setPreviewGeneratedAt] = useState<string | null>(null);
  const [blocksIncluded, setBlocksIncluded] = useState<string[]>([]);
  const [blocksSkipped, setBlocksSkipped] = useState<string[]>([]);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  // ─── Recipient count ─────────────────────────────────────────────────────────
  const [recipientCount, setRecipientCount] = useState<number>(0);

  // ─── Save state ──────────────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);

  // Prevent auto-save overwriting while actively saving
  const savingRef = useRef(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NewsletterFormData>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: {
      title: "",
      subject: "",
      previewText: "",
      content: "",
      contentJson: null,
      status: "draft",
    },
  });

  const content = watch("content");
  const title = watch("title");

  // ─── Load newsletter ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchNewsletter = async () => {
      try {
        const res = await fetch(`/api/admin/newsletters/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("Newsletter not found");
          } else {
            throw new Error("Failed to fetch");
          }
          return;
        }
        const data: Newsletter & { previewHtml?: string; previewGeneratedAt?: string } =
          await res.json();
        setNewsletter(data);
        // Populate form
        setValue("title", data.title || "");
        setValue("subject", data.subject || "");
        setValue("previewText", data.previewText || "");
        setValue("content", data.content || "");
        setValue("contentJson", data.contentJson || null);
        setValue("status", data.status || "draft");
        // Restore preview if it exists
        if (data.previewHtml) setPreviewHtml(data.previewHtml);
        if (data.previewGeneratedAt) setPreviewGeneratedAt(data.previewGeneratedAt);
      } catch (err) {
        console.error(err);
        setError("Failed to load newsletter");
      } finally {
        setIsLoading(false);
      }
    };

    fetchNewsletter();
  }, [id, setValue]);

  // ─── Load recipient count ────────────────────────────────────────────────────
  useEffect(() => {
    if (isNaN(newsletterId)) return;
    fetch(`/api/admin/newsletters/${newsletterId}/recipient-count`)
      .then((r) => r.json())
      .then((d) => setRecipientCount(d.count ?? 0))
      .catch(() => {});
  }, [newsletterId]);

  // ─── Editor change ───────────────────────────────────────────────────────────
  const handleEditorChange = (html: string, json: unknown) => {
    setValue("content", html, { shouldDirty: true });
    setValue("contentJson", json, { shouldDirty: true });
  };

  // ─── Save draft ──────────────────────────────────────────────────────────────
  const onSubmit = async (data: NewsletterFormData) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/newsletters/${newsletterId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save");
      }

      toast.success("Draft saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save newsletter");
    } finally {
      setIsSaving(false);
      savingRef.current = false;
    }
  };

  // ─── Generate preview ─────────────────────────────────────────────────────────
  const generatePreview = async () => {
    setIsGeneratingPreview(true);
    try {
      const res = await fetch(`/api/admin/newsletters/${newsletterId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // block settings read from DB
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate preview");
      }

      const result = await res.json();
      setPreviewHtml(result.previewHtml);
      setPreviewGeneratedAt(result.previewGeneratedAt);
      setBlocksIncluded(result.blocksIncluded || []);
      setBlocksSkipped(result.blocksSkipped || []);
      setPreviewOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate preview");
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  // ─── Send to all ──────────────────────────────────────────────────────────────
  const handleSendToAll = async () => {
    try {
      const res = await fetch(`/api/admin/newsletters/${newsletterId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience: "newsletter" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send");
      }

      const result = await res.json();
      toast.success(
        `Newsletter sent to ${result.sent ?? result.totalRecipients ?? recipientCount} recipients`
      );
      router.push("/admin/newsletters");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send newsletter");
      throw err; // re-throw so modal can handle
    }
  };

  // ─── Loading / error states ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400 mr-2" />
        <p className="text-gray-500">Loading newsletter...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <p className="text-red-500">{error}</p>
        <button
          onClick={() => router.push("/admin/newsletters")}
          className="text-blue-600 hover:underline"
        >
          Back to newsletters
        </button>
      </div>
    );
  }

  if (!newsletter) return null;

  const isDraft = newsletter.status === "draft";

  return (
    // Negative margins cancel the admin main's padding so we get full width
    <div className="flex flex-col -m-4 md:-m-6">
      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-white">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/newsletters">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <h1 className="text-lg font-semibold text-gray-900">
            {title || "Edit Newsletter"}
          </h1>
        </div>

        {/* Mobile: Content Blocks sheet trigger */}
        <div className="flex items-center gap-2 lg:hidden">
          <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Layers className="h-4 w-4 mr-1.5" />
                Content Blocks
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 p-0">
              <SheetHeader className="px-4 py-3 border-b">
                <SheetTitle>Content Blocks</SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto h-full pb-16">
                <NewsletterBlockSidebar
                  newsletterId={newsletterId}
                  isCollapsed={false}
                  onCollapseToggle={() => setMobileSidebarOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* ── Main content area ─────────────────────────────────────────────────── */}
      <div className="flex">
        {/* Editor column */}
        <div className="flex-1 min-w-0 px-6 py-4 space-y-4 pb-24">
          {/* Metadata fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Internal Title</Label>
              <Input
                id="title"
                {...register("title")}
                placeholder="e.g., Weekly Update - Jan 2025"
              />
              {errors.title && (
                <p className="text-xs text-red-500">{errors.title.message}</p>
              )}
              <p className="text-xs text-gray-400">For internal reference only</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="subject">Email Subject Line</Label>
              <Input
                id="subject"
                {...register("subject")}
                placeholder="e.g., This Week in Toronto's Jewish Community"
              />
              {errors.subject && (
                <p className="text-xs text-red-500">{errors.subject.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="previewText">Preview Text (Optional)</Label>
            <Input
              id="previewText"
              {...register("previewText")}
              placeholder="Brief preview shown in email clients..."
              maxLength={200}
            />
            <p className="text-xs text-gray-400">
              Shown in email clients next to subject line (max 200 chars)
            </p>
          </div>

          {/* TipTap editor */}
          <div className="space-y-1.5">
            <Label>Content</Label>
            <NewsletterEditor
              content={content}
              contentJson={newsletter?.contentJson}
              onChange={handleEditorChange}
            />
            {errors.content && (
              <p className="text-xs text-red-500">{errors.content.message}</p>
            )}
          </div>
        </div>

        {/* Desktop sidebar — hidden on mobile, sticky so it stays while editor scrolls */}
        <div className="hidden lg:block flex-shrink-0 self-start sticky top-0">
          <div style={{ height: "calc(100vh - 120px)" }} className="flex">
            <NewsletterBlockSidebar
              newsletterId={newsletterId}
              isCollapsed={sidebarCollapsed}
              onCollapseToggle={() => setSidebarCollapsed((c) => !c)}
            />
          </div>
        </div>
      </div>

      {/* ── Sticky bottom action bar ──────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 z-30 border-t bg-white px-6 py-3 flex items-center justify-between shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Users className="h-4 w-4" />
          <span>~{recipientCount.toLocaleString()} recipients</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Save Draft */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSubmit(onSubmit)}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            {isSaving ? "Saving..." : "Save Draft"}
          </Button>

          {/* Preview Email */}
          {isDraft && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generatePreview}
              disabled={isGeneratingPreview}
            >
              {isGeneratingPreview ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Eye className="h-3.5 w-3.5 mr-1.5" />
              )}
              {isGeneratingPreview ? "Generating..." : "Preview Email"}
            </Button>
          )}

          {/* Re-open preview if already generated */}
          {isDraft && previewHtml && !previewOpen && !isGeneratingPreview && (
            <Button
              type="button"
              size="sm"
              onClick={() => setPreviewOpen(true)}
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Send
            </Button>
          )}
        </div>
      </div>

      {/* ── Preview modal ─────────────────────────────────────────────────────── */}
      <NewsletterPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        newsletterId={newsletterId}
        previewHtml={previewHtml}
        previewGeneratedAt={previewGeneratedAt}
        blocksIncluded={blocksIncluded}
        blocksSkipped={blocksSkipped}
        onRegeneratePreview={generatePreview}
        onSendToAll={handleSendToAll}
        recipientCount={recipientCount}
      />
    </div>
  );
}
