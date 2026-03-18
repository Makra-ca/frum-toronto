"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BlogPostEditor } from "@/components/blog/BlogPostEditor";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface BlogCategory {
  id: number;
  name: string;
}

export default function NewBlogPostPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/admin/blog/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data || []);
      }
    } catch (error) {
      console.error("[BLOG] Error fetching categories:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: {
    title: string;
    content: string;
    contentJson: unknown;
    coverImageUrl: string | null;
    excerpt: string | null;
    categoryId: number | null;
    customCategory: string | null;
    commentModeration: string | null;
  }) => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        toast.success("Blog post created");
        router.push("/admin/programs/blog");
      } else {
        const result = await res.json();
        toast.error(result.error || "Failed to create post");
      }
    } catch {
      toast.error("Failed to create post");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    router.push("/admin/programs/blog");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <BlogPostEditor
      categories={categories}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      isLoading={isSaving}
      isAdmin={true}
    />
  );
}
