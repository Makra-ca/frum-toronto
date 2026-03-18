"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { BlogPostEditor } from "@/components/blog/BlogPostEditor";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Loader2, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Category {
  id: number;
  name: string;
}

interface BlogPostData {
  id: number;
  title: string;
  slug: string;
  content: string;
  contentJson: unknown;
  coverImageUrl: string | null;
  excerpt: string | null;
  categoryId: number | null;
  customCategory: string | null;
  commentModeration: string | null;
  approvalStatus: string;
}

export default function EditBlogPostPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [post, setPost] = useState<BlogPostData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      Promise.all([fetchPost(), fetchCategories()]).finally(() =>
        setIsLoading(false)
      );
    }
  }, [id]);

  const fetchPost = async () => {
    try {
      const res = await fetch(`/api/user/blog/${id}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to load blog post");
        return;
      }

      const data = await res.json();

      if (
        data.approvalStatus !== "pending" &&
        data.approvalStatus !== "rejected"
      ) {
        setError(
          "Only pending or rejected posts can be edited. Approved posts are locked."
        );
        return;
      }

      setPost(data);
    } catch {
      setError("Failed to load blog post");
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/blog/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
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
      const res = await fetch(`/api/user/blog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to update blog post");
        return;
      }

      toast.success("Blog post updated and resubmitted for review");
      router.push("/dashboard/blog");
    } catch {
      toast.error("Failed to update blog post");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
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

  if (error) {
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
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-red-400 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Cannot Edit Post</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={() => router.push("/dashboard/blog")}>
                Back to My Posts
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!post) return null;

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

        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Editing will resubmit your post for approval. It will be reviewed by
            a moderator before being published.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Edit Blog Post</CardTitle>
          </CardHeader>
          <CardContent>
            <BlogPostEditor
              initialData={{
                id: post.id,
                title: post.title,
                content: post.content,
                contentJson: post.contentJson,
                coverImageUrl: post.coverImageUrl,
                excerpt: post.excerpt,
                categoryId: post.categoryId,
                customCategory: post.customCategory,
                commentModeration: post.commentModeration,
              }}
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
