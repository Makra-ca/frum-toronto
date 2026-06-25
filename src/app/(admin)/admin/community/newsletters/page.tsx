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
import { FileText, Loader2, Trash2, Pencil, Download, Newspaper, X } from "lucide-react";
import { toast } from "sonner";
import { uploadFile } from "@/lib/upload-client";

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
  const [isLoading, setIsLoading] = useState(true);

  // Create/edit form
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [publisher, setPublisher] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<CommunityNewsletter | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  useEffect(() => {
    fetchNewsletters();
  }, [fetchNewsletters]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setPublisher("");
    setDescription("");
    setSelectedFile(null);
    setExistingFileUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function startEdit(n: CommunityNewsletter) {
    setEditingId(n.id);
    setTitle(n.title);
    setPublisher(n.publisher || "");
    setDescription(n.description || "");
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
              />
            </div>
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
            <Card key={n.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{n.title}</p>
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
