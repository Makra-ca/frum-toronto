"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { FileText, Upload, Trash2, Loader2, Newspaper, BookOpen, Download, Calendar, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";

interface ShulDocument {
  id: number;
  shulId: number;
  title: string;
  type: string;
  fileUrl: string;
  fileSize: number | null;
  description: string | null;
  publishedAt: string;
  createdAt: string;
}

interface ShulDocumentsProps {
  shulId: number;
  apiBasePath?: string; // defaults to /api/admin/shuls
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ShulDocuments({ shulId, apiBasePath = "/api/admin/shuls" }: ShulDocumentsProps) {
  const [documents, setDocuments] = useState<ShulDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<ShulDocument | null>(null);

  // Upload form state
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("newsletter");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`${apiBasePath}/${shulId}/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      } else {
        console.error("Failed to fetch documents:", res.status);
        toast.error("Failed to load documents");
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast.error("Failed to load documents");
    } finally {
      setIsLoading(false);
    }
  }, [apiBasePath, shulId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  async function handleUpload() {
    if (!selectedFile || !title.trim()) {
      toast.error("Please provide a title and select a PDF file");
      return;
    }

    setIsUploading(true);
    try {
      // 1. Upload file to Vercel Blob
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("folder", `shul-documents/${shulId}`);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || "Upload failed");
      }

      const { url } = await uploadRes.json();

      // 2. Create document record
      const docRes = await fetch(`${apiBasePath}/${shulId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          type,
          fileUrl: url,
          fileSize: selectedFile.size,
          description: description.trim() || null,
        }),
      });

      if (!docRes.ok) {
        const err = await docRes.json();
        throw new Error(err.error || "Failed to create document");
      }

      toast.success("Document uploaded successfully");
      resetForm();
      fetchDocuments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete() {
    if (!deletingDoc) return;

    try {
      const res = await fetch(`${apiBasePath}/${shulId}/documents/${deletingDoc.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");

      toast.success("Document deleted");
      setDeletingDoc(null);
      fetchDocuments();
    } catch (error) {
      toast.error("Failed to delete document");
    }
  }

  function resetForm() {
    setTitle("");
    setType("newsletter");
    setDescription("");
    setSelectedFile(null);
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setFilePreviewUrl(null);
    setShowUploadForm(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const newsletters = documents.filter((d) => d.type === "newsletter");
  const tefillos = documents.filter((d) => d.type === "tefillah");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Documents</h3>
        <Button
          size="sm"
          onClick={() => setShowUploadForm(!showUploadForm)}
          variant={showUploadForm ? "outline" : "default"}
        >
          {showUploadForm ? (
            "Cancel"
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </>
          )}
        </Button>
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <div className="border rounded-lg p-5 bg-gray-50 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="doc-title">Title *</Label>
              <Input
                id="doc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Weekly Bulletin - March 14"
              />
            </div>
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newsletter">Newsletter</SelectItem>
                  <SelectItem value="tefillah">Tefillah</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this document"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>File (PDF or Image) *</Label>
            <Input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="cursor-pointer file:cursor-pointer"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setSelectedFile(file);
                if (file) {
                  setFilePreviewUrl(URL.createObjectURL(file));
                } else {
                  setFilePreviewUrl(null);
                }
              }}
            />
            {selectedFile && filePreviewUrl && (
              <div className="mt-2 border rounded-lg overflow-hidden bg-white">
                <div className="relative w-full h-48">
                  {selectedFile.type.startsWith("image/") ? (
                    <img
                      src={filePreviewUrl}
                      alt="Preview"
                      className="w-full h-full object-contain bg-gray-50"
                    />
                  ) : (
                    <iframe
                      src={`${filePreviewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                      className="w-full h-full"
                      title="PDF Preview"
                    />
                  )}
                </div>
                <div className="px-3 py-2 bg-gray-50 border-t text-xs text-gray-500">
                  {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleUpload();
              }}
              disabled={isUploading || !title.trim() || !selectedFile}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="text-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8 text-gray-500 border rounded-lg bg-gray-50">
          <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p>No documents uploaded yet</p>
          <p className="text-sm mt-1">Upload newsletters and tefillos for this shul</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Newsletters */}
          {newsletters.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Newspaper className="h-4 w-4" />
                Newsletters ({newsletters.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {newsletters.map((doc) => (
                  <DocumentCard key={doc.id} document={doc} onDelete={setDeletingDoc} apiBasePath={apiBasePath} shulId={shulId} onUpdated={fetchDocuments} />
                ))}
              </div>
            </div>
          )}

          {/* Tefillos */}
          {tefillos.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Tefillos ({tefillos.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tefillos.map((doc) => (
                  <DocumentCard key={doc.id} document={doc} onDelete={setDeletingDoc} apiBasePath={apiBasePath} shulId={shulId} onUpdated={fetchDocuments} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingDoc} onOpenChange={(open) => !open && setDeletingDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingDoc?.title}&quot;? This will also remove the file. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);
}

function DocumentCard({
  document,
  onDelete,
  apiBasePath,
  shulId,
  onUpdated,
}: {
  document: ShulDocument;
  onDelete: (doc: ShulDocument) => void;
  apiBasePath: string;
  shulId: number;
  onUpdated: () => void;
}) {
  const isImage = isImageUrl(document.fileUrl);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(document.title);
  const [editType, setEditType] = useState(document.type);
  const [editDescription, setEditDescription] = useState(document.description || "");
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const replaceFileRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    setIsSaving(true);
    try {
      let newFileUrl: string | undefined;

      // Upload replacement file if selected
      if (replaceFile) {
        const formData = new FormData();
        formData.append("file", replaceFile);
        formData.append("folder", `shul-documents/${shulId}`);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.error || "File upload failed");
        }
        const { url } = await uploadRes.json();
        newFileUrl = url;
      }

      const body: Record<string, unknown> = {
        title: editTitle.trim(),
        type: editType,
        description: editDescription.trim() || null,
      };
      if (newFileUrl) body.fileUrl = newFileUrl;
      if (replaceFile) body.fileSize = replaceFile.size;

      const res = await fetch(`${apiBasePath}/${shulId}/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success("Document updated");
      setIsEditing(false);
      setReplaceFile(null);
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update document");
    } finally {
      setIsSaving(false);
    }
  }

  function cancelEdit() {
    setIsEditing(false);
    setEditTitle(document.title);
    setEditType(document.type);
    setEditDescription(document.description || "");
    setReplaceFile(null);
    if (replaceFileRef.current) replaceFileRef.current.value = "";
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow">
      {/* Preview */}
      <a
        href={document.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <div className="relative w-full h-44 bg-gray-100">
          {isImage ? (
            <img
              src={document.fileUrl}
              alt={document.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <iframe
              src={`${document.fileUrl}#toolbar=0&navpanes=0&scrollbar=0`}
              className="w-full h-full pointer-events-none"
              title={document.title}
            />
          )}
        </div>
      </a>

      {/* Info / Edit */}
      <div className="p-3">
        {isEditing ? (
          <div className="space-y-2">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Title"
              className="h-8 text-sm"
            />
            <Select value={editType} onValueChange={setEditType}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newsletter">Newsletter</SelectItem>
                <SelectItem value="tefillah">Tefillah</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="text-sm resize-y min-h-[50px]"
            />
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Replace file (optional)</Label>
              <Input
                ref={replaceFileRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => setReplaceFile(e.target.files?.[0] || null)}
                className="h-8 text-xs cursor-pointer file:cursor-pointer"
              />
              {replaceFile && (
                <p className="text-xs text-blue-600">{replaceFile.name} ({formatFileSize(replaceFile.size)})</p>
              )}
            </div>
            <div className="flex items-center gap-1 pt-1">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !editTitle.trim()}
                className="flex-1 inline-flex items-center justify-center h-7 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Check className="h-3 w-3 mr-1" />
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="inline-flex items-center justify-center h-7 px-3 text-xs rounded border text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="font-medium text-gray-900 text-sm truncate">{document.title}</p>
            {document.description && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{document.description}</p>
            )}
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
              <span>{formatDate(document.publishedAt)}</span>
              {document.fileSize && <span>{formatFileSize(document.fileSize)}</span>}
            </div>

            {/* Actions - icon only */}
            <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t">
              <a
                href={document.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-8 w-8 rounded hover:bg-gray-100 text-gray-600"
                title="Open"
              >
                <Download className="h-4 w-4" />
              </a>
              <button
                type="button"
                className="inline-flex items-center justify-center h-8 w-8 rounded hover:bg-gray-100 text-gray-600"
                onClick={() => setIsEditing(true)}
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center h-8 w-8 rounded hover:bg-red-50 text-red-600"
                onClick={() => onDelete(document)}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
