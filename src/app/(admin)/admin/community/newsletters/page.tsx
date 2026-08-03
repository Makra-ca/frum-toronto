"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText,
  Loader2,
  Trash2,
  Pencil,
  Download,
  Newspaper,
  X,
  Eye,
  EyeOff,
  Building2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { uploadFile } from "@/lib/upload-client";
import { toDateInputValue } from "@/lib/datetime";

/** A shul's own newsletter — listed here, but owned and edited by the shul. */
interface ShulNewsletter {
  id: number;
  title: string;
  fileUrl: string;
  fileSize: number | null;
  description: string | null;
  publishedAt: string | null;
  shulId: number;
  shulName: string;
}

interface CommunityNewsletter {
  id: number;
  title: string;
  publisher: string | null;
  fileUrl: string;
  fileSize: number | null;
  description: string | null;
  publishedAt: string | null;
  isActive: boolean | null;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CommunityNewslettersPage() {
  const [newsletters, setNewsletters] = useState<CommunityNewsletter[]>([]);
  const [shulNewsletters, setShulNewsletters] = useState<ShulNewsletter[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create/edit form
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [publisher, setPublisher] = useState("");
  const [description, setDescription] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<CommunityNewsletter | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const fetchNewsletters = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/community-newsletters");
      if (res.ok) setNewsletters(await res.json());
    } catch {
      toast.error("Failed to load newsletters");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Two tables feed one public page, managed from two unrelated screens — so
  // until now no screen could answer "what is live right now". This one reads
  // across both; the shul side stays read-only because shul managers own it.
  const fetchShulNewsletters = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/community-newsletters/shul-list");
      if (res.ok) setShulNewsletters(await res.json());
    } catch {
      toast.error("Failed to load shul newsletters");
    }
  }, []);

  useEffect(() => {
    fetchNewsletters();
    fetchShulNewsletters();
  }, [fetchNewsletters, fetchShulNewsletters]);

  // Publishers already in use, offered as suggestions. This is the only thing
  // standing between "Israel News" and "Israeli News" splitting one archive
  // into two series that can never be merged from the reader's side. Derived
  // from the list already on the page — no extra request.
  const knownPublishers = [
    ...new Set(
      newsletters
        .map((n) => n.publisher?.trim())
        .filter((p): p is string => !!p)
    ),
  ].sort((a, b) => a.localeCompare(b));

  // `is_active` is nullable and defaults true, so only an explicit false hides
  // a row — matching the public page's own reading of the column.
  const isLive = (n: CommunityNewsletter) => n.isActive !== false;

  async function toggleActive(n: CommunityNewsletter) {
    const next = !isLive(n);
    setTogglingId(n.id);
    try {
      const res = await fetch(`/api/admin/community-newsletters/${n.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success(next ? "Newsletter is live" : "Newsletter hidden from the public page");
      fetchNewsletters();
    } catch {
      toast.error("Failed to update newsletter");
    } finally {
      setTogglingId(null);
    }
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setPublisher("");
    setDescription("");
    setPublishedAt("");
    setSelectedFile(null);
    setExistingFileUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function startEdit(n: CommunityNewsletter) {
    setEditingId(n.id);
    setTitle(n.title);
    setPublisher(n.publisher || "");
    setDescription(n.description || "");
    setPublishedAt(n.publishedAt ? toDateInputValue(n.publishedAt) : "");
    setSelectedFile(null);
    setExistingFileUrl(n.fileUrl);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!editingId && !selectedFile) {
      toast.error("Please select a PDF or image file");
      return;
    }

    setIsSaving(true);
    try {
      let fileUrl = existingFileUrl;
      let fileSize: number | null = null;

      if (selectedFile) {
        const uploaded = await uploadFile(selectedFile, "community-newsletters");
        fileUrl = uploaded.url;
        fileSize = selectedFile.size;
      }

      if (editingId) {
        const body: Record<string, unknown> = {
          title: title.trim(),
          publisher: publisher.trim() || null,
          description: description.trim() || null,
          publishedAt,
        };
        if (selectedFile) {
          body.fileUrl = fileUrl;
          body.fileSize = fileSize;
        }
        const res = await fetch(`/api/admin/community-newsletters/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Failed to update");
        toast.success("Newsletter updated");
      } else {
        const res = await fetch("/api/admin/community-newsletters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            publisher: publisher.trim() || null,
            fileUrl,
            fileSize,
            description: description.trim() || null,
            publishedAt,
          }),
        });
        if (!res.ok) throw new Error("Failed to create");
        toast.success("Newsletter added");
      }

      resetForm();
      fetchNewsletters();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/community-newsletters/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Newsletter deleted");
      setDeleteTarget(null);
      fetchNewsletters();
    } catch {
      toast.error("Failed to delete newsletter");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Newspaper className="h-5 w-5" />
          Community Newsletters
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Upload community-wide newsletters not tied to a shul (e.g. Israeli News). These appear
          on the public newsletters page. This is separate from the email newsletter system.
        </p>
      </div>

      {/* Create / edit form */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <p className="font-medium text-sm">
            {editingId ? "Edit newsletter" : "Add a newsletter"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Israeli News — Week of June 20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="publisher">Publisher / Source</Label>
              <Input
                id="publisher"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                placeholder="e.g., Israeli News"
                list="publisher-options"
                autoComplete="off"
              />
              <datalist id="publisher-options">
                {knownPublishers.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              <p className="text-xs text-gray-500">
                Groups issues into one named series on the public page. Pick an
                existing name — a new spelling starts a separate series.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="publishedAt">Published</Label>
            <Input
              id="publishedAt"
              type="date"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              The issue date. Leave blank for today.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">
              {editingId ? "Replace file (optional)" : "File (PDF or image) *"}
            </Label>
            <Input
              ref={fileInputRef}
              id="file"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="cursor-pointer file:cursor-pointer"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                if (file && file.size > 30 * 1024 * 1024) {
                  toast.error("Maximum file size is 30MB");
                  e.target.value = "";
                  return;
                }
                setSelectedFile(file);
              }}
            />
            {editingId && existingFileUrl && !selectedFile && (
              <a
                href={existingFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <FileText className="h-3 w-3" /> Current file
              </a>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? "Save changes" : "Add newsletter"}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm} disabled={isSaving}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : newsletters.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-8">No community newsletters yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {newsletters.map((n) => (
            <Card key={n.id} className={isLive(n) ? undefined : "bg-gray-50 border-dashed"}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{n.title}</p>
                      {/* This screen's whole job is "what is live right now",
                          and the list has no isActive filter — without a badge
                          a hidden newsletter looks published here and is absent
                          from the public page. */}
                      {!isLive(n) && (
                        <span className="flex-shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">
                          Hidden
                        </span>
                      )}
                    </div>
                    {n.publisher && (
                      <p className="text-xs text-gray-500">{n.publisher}</p>
                    )}
                    {n.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{n.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <a
                        href={n.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <Download className="h-3 w-3" /> View
                        {n.fileSize ? ` (${formatFileSize(n.fileSize)})` : ""}
                      </a>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      title={isLive(n) ? "Hide from the public page" : "Show on the public page"}
                      disabled={togglingId === n.id}
                      onClick={() => toggleActive(n)}
                    >
                      {togglingId === n.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isLive(n) ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => startEdit(n)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setDeleteTarget(n)}
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

      {/* Read-only: these rows belong to the shuls, which upload them
          themselves through Shuls → Docs. They are listed here so this screen
          shows everything on the public newsletters page, not so it can edit
          them — hence a link out rather than edit and delete controls. */}
      {shulNewsletters.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Shul newsletters
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Also live on the public newsletters page. Uploaded and edited by
              each shul under Shuls → Docs.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {shulNewsletters.map((n) => (
              <Card key={n.id} className="bg-gray-50/60">
                <CardContent className="p-4">
                  <p className="font-medium truncate">{n.title}</p>
                  <p className="text-xs text-gray-500">{n.shulName}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <a
                      href={n.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <Download className="h-3 w-3" /> View
                      {n.fileSize ? ` (${formatFileSize(n.fileSize)})` : ""}
                    </a>
                    <Link
                      href={`/admin/shuls?docs=${n.shulId}`}
                      className="inline-flex items-center gap-1 text-xs text-gray-600 hover:underline"
                    >
                      <Pencil className="h-3 w-3" /> Manage in Shuls
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete newsletter?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &quot;{deleteTarget?.title}&quot; from the public newsletters page.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
