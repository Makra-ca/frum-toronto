"use client";

import { useState } from "react";
import { toast } from "sonner";
import { NewsletterEditor } from "@/components/newsletter/NewsletterEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";

interface BlogPostEditorProps {
  initialData?: {
    id?: number;
    title?: string;
    content?: string;
    contentJson?: unknown;
    coverImageUrl?: string | null;
    excerpt?: string | null;
    categoryId?: number | null;
    customCategory?: string | null;
    commentModeration?: string | null;
  };
  categories: { id: number; name: string }[];
  onSubmit: (data: {
    title: string;
    content: string;
    contentJson: unknown;
    coverImageUrl: string | null;
    excerpt: string | null;
    categoryId: number | null;
    customCategory: string | null;
    commentModeration: string | null;
  }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  isAdmin?: boolean;
}

export function BlogPostEditor({
  initialData,
  categories,
  onSubmit,
  onCancel,
  isLoading = false,
  isAdmin = false,
}: BlogPostEditorProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [content, setContent] = useState(initialData?.content || "");
  const [contentJson, setContentJson] = useState<unknown>(
    initialData?.contentJson || null
  );
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(
    initialData?.coverImageUrl || null
  );
  const [excerpt, setExcerpt] = useState(initialData?.excerpt || "");
  const [categoryId, setCategoryId] = useState<number | null>(
    initialData?.categoryId || null
  );
  const [customCategory, setCustomCategory] = useState(
    initialData?.customCategory || ""
  );
  const [commentModeration, setCommentModeration] = useState<string | null>(
    initialData?.commentModeration || null
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isCustomCategory, setIsCustomCategory] = useState(
    !!initialData?.customCategory
  );

  const handleEditorChange = (html: string, json: unknown) => {
    setContent(html);
    setContentJson(json);
  };

  const handleCoverImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      const data = await res.json();
      setCoverImageUrl(data.url);
      toast.success("Cover image uploaded");
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (!content.trim() || content === "<p></p>") {
      toast.error("Content is required");
      return;
    }

    await onSubmit({
      title: title.trim(),
      content,
      contentJson,
      coverImageUrl,
      excerpt: excerpt.trim() || null,
      categoryId: isCustomCategory ? null : categoryId,
      customCategory: isCustomCategory ? customCategory.trim() || null : null,
      commentModeration: isAdmin ? commentModeration : null,
    });
  };

  const handleCategoryChange = (value: string) => {
    if (value === "custom") {
      setIsCustomCategory(true);
      setCategoryId(null);
    } else {
      setIsCustomCategory(false);
      setCategoryId(parseInt(value));
      setCustomCategory("");
    }
  };

  const getCategorySelectValue = () => {
    if (isCustomCategory) return "custom";
    if (categoryId) return String(categoryId);
    return "none";
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Post title"
          className="text-2xl font-semibold h-14 border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-600"
        />
      </div>

      {/* Cover Image */}
      <Card>
        <CardContent className="p-4">
          <Label className="text-sm font-medium mb-3 block">Cover Image</Label>
          {coverImageUrl ? (
            <div className="relative">
              <img
                src={coverImageUrl}
                alt="Cover preview"
                className="w-full max-h-64 object-cover rounded-lg"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={() => setCoverImageUrl(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
              <div className="flex flex-col items-center gap-2 text-gray-500">
                {isUploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                ) : (
                  <>
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-sm font-medium">
                      Click to upload cover image
                    </span>
                    <span className="text-xs text-gray-400">
                      JPG, PNG, WebP
                    </span>
                  </>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverImageUpload}
                className="hidden"
                disabled={isUploading}
              />
            </label>
          )}
        </CardContent>
      </Card>

      {/* Category & Excerpt Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category */}
        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={getCategorySelectValue()}
            onValueChange={handleCategoryChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No category</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={String(cat.id)}>
                  {cat.name}
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom...</SelectItem>
            </SelectContent>
          </Select>
          {isCustomCategory && (
            <Input
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="Enter custom category"
              className="mt-2"
            />
          )}
        </div>

        {/* Comment Moderation - Admin only */}
        {isAdmin && (
          <div className="space-y-2">
            <Label>Comment Moderation</Label>
            <Select
              value={commentModeration || "default"}
              onValueChange={(val) =>
                setCommentModeration(val === "default" ? null : val)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Use default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Use default</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="require_approval">
                  Require approval
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Excerpt */}
      <div className="space-y-2">
        <Label>Excerpt (optional)</Label>
        <Textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder="A short summary of your post..."
          rows={3}
        />
      </div>

      {/* TipTap Editor */}
      <div className="space-y-2">
        <Label>Content</Label>
        <NewsletterEditor
          content={content}
          contentJson={contentJson}
          onChange={handleEditorChange}
          placeholder="Write your blog post..."
        />
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isLoading || isUploading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : initialData?.id ? (
            "Update Post"
          ) : (
            "Publish Post"
          )}
        </Button>
      </div>
    </div>
  );
}
