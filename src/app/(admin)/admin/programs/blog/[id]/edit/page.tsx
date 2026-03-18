"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { BlogPostEditor } from "@/components/blog/BlogPostEditor";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface BlogCategory {
  id: number;
  name: string;
}

interface BlogPostData {
  id: number;
  title: string;
  content: string;
  contentJson: unknown;
  coverImageUrl: string | null;
  excerpt: string | null;
  categoryId: number | null;
  customCategory: string | null;
  commentModeration: string | null;
}

export default function EditBlogPostPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [post, setPost] = useState<BlogPostData | null>(null);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (id) {
      Promise.all([fetchPost(), fetchCategories()]).finally(() => {
        setIsLoading(false);
      });
    }
  }, [id]);

  const fetchPost = async () => {
    try {
      const res = await fetch(`/api/admin/blog/${id}`);
      if (res.ok) {
        const data = await res.json();
        setPost(data);
      } else {
        toast.error("Failed to load post");
        router.push("/admin/programs/blog");
      }
    } catch (error) {
      console.error("[BLOG] Error fetching post:", error);
      toast.error("Failed to load post");
      router.push("/admin/programs/blog");
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/admin/blog/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data || []);
      }
    } catch (error) {
      console.error("[BLOG] Error fetching categories:", error);
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
      const res = await fetch(`/api/admin/blog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        toast.success("Blog post updated");
        router.push("/admin/programs/blog");
      } else {
        const result = await res.json();
        toast.error(result.error || "Failed to update post");
      }
    } catch {
      toast.error("Failed to update post");
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

  if (!post) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Post not found</p>
      </div>
    );
  }

  return (
    <BlogPostEditor
      initialData={post}
      categories={categories}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      isLoading={isSaving}
      isAdmin={true}
    />
  );
}
