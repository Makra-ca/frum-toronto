"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BlogPostEditor } from "@/components/blog/BlogPostEditor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: number;
  name: string;
}

export default function NewBlogPostPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/blog/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    } finally {
      setIsLoadingCategories(false);
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
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/user/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to create blog post");
        return;
      }

      toast.success("Blog post submitted successfully");
      router.push("/dashboard/blog");
    } catch {
      toast.error("Failed to create blog post");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingCategories) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto py-12 px-4">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="mb-6">
          <Link
            href="/dashboard/blog"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to My Posts
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Write a New Blog Post</CardTitle>
          </CardHeader>
          <CardContent>
            <BlogPostEditor
              categories={categories}
              onSubmit={handleSubmit}
              onCancel={() => router.push("/dashboard/blog")}
              isLoading={isSubmitting}
              isAdmin={false}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
