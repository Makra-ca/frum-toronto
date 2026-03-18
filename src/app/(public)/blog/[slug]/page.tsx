import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { blogPosts, blogCategories, users } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { Calendar, ArrowLeft, Eye, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BlogComments } from "@/components/blog/BlogComments";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getPost(slug: string) {
  const [post] = await db
    .select({
      id: blogPosts.id,
      title: blogPosts.title,
      slug: blogPosts.slug,
      content: blogPosts.content,
      coverImageUrl: blogPosts.coverImageUrl,
      excerpt: blogPosts.excerpt,
      authorId: blogPosts.authorId,
      categoryId: blogPosts.categoryId,
      customCategory: blogPosts.customCategory,
      commentModeration: blogPosts.commentModeration,
      viewCount: blogPosts.viewCount,
      publishedAt: blogPosts.publishedAt,
      createdAt: blogPosts.createdAt,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
      categoryName: blogCategories.name,
    })
    .from(blogPosts)
    .leftJoin(users, eq(blogPosts.authorId, users.id))
    .leftJoin(blogCategories, eq(blogPosts.categoryId, blogCategories.id))
    .where(
      and(
        eq(blogPosts.slug, slug),
        eq(blogPosts.approvalStatus, "approved"),
        eq(blogPosts.isActive, true)
      )
    )
    .limit(1);

  if (post) {
    // Increment view count (fire and forget is fine for server component)
    db.update(blogPosts)
      .set({ viewCount: sql`view_count + 1` })
      .where(eq(blogPosts.id, post.id))
      .then(() => {})
      .catch(() => {});
  }

  return post;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    return { title: "Post Not Found | FrumToronto" };
  }

  return {
    title: `${post.title} | FrumToronto Blog`,
    description: post.excerpt || post.title,
    openGraph: {
      title: post.title,
      description: post.excerpt || post.title,
      images: post.coverImageUrl ? [post.coverImageUrl] : [],
    },
  };
}

function formatDate(dateStr: string | Date | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    notFound();
  }

  const authorName = [post.authorFirstName, post.authorLastName]
    .filter(Boolean)
    .join(" ");
  const categoryLabel = post.categoryName || post.customCategory;
  const moderationNotice = post.commentModeration === "approved";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cover Image */}
      {post.coverImageUrl && (
        <div className="relative w-full h-64 md:h-96 overflow-hidden">
          <Image
            src={post.coverImageUrl}
            alt={post.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      )}

      {/* If no cover image, show blue gradient header */}
      {!post.coverImageUrl && (
        <div className="bg-blue-900 h-32 md:h-48" />
      )}

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 -mt-8 relative z-10 pb-16">
        {/* Back link */}
        <div className="mb-6">
          <Link href="/blog">
            <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Blog
            </Button>
          </Link>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-10">
          {/* Category Badge */}
          {categoryLabel && (
            <Badge variant="secondary" className="mb-4">
              {categoryLabel}
            </Badge>
          )}

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {post.title}
          </h1>

          {/* Author & Date */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-8 pb-6 border-b">
            {authorName && (
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                By {authorName}
              </span>
            )}
            {(post.publishedAt || post.createdAt) && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {formatDate(post.publishedAt || post.createdAt)}
              </span>
            )}
            {post.viewCount !== null && post.viewCount > 0 && (
              <span className="flex items-center gap-1.5">
                <Eye className="h-4 w-4" />
                {post.viewCount} view{post.viewCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Post Content */}
          <div
            className="prose prose-lg max-w-none
              prose-headings:text-gray-900 prose-headings:font-bold
              prose-p:text-gray-700 prose-p:leading-relaxed
              prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
              prose-img:rounded-lg prose-img:shadow-md
              prose-blockquote:border-l-blue-500 prose-blockquote:text-gray-600
              prose-strong:text-gray-900
              prose-ul:text-gray-700 prose-ol:text-gray-700
              prose-li:marker:text-blue-500
              [&_h1]:text-2xl [&_h1]:mt-8 [&_h1]:mb-4
              [&_h2]:text-xl [&_h2]:mt-6 [&_h2]:mb-3
              [&_h3]:text-lg [&_h3]:mt-5 [&_h3]:mb-2
              [&_p]:mb-4 [&_p]:text-base
              [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4
              [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4
              [&_li]:mb-1
              [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg
              [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-600
              [&_pre]:bg-gray-900 [&_pre]:text-gray-100 [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto
              [&_code]:bg-gray-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm
              [&_pre_code]:bg-transparent [&_pre_code]:p-0
              [&_a]:text-blue-600 [&_a:hover]:underline
              [&_hr]:border-gray-200 [&_hr]:my-8
              [&_table]:border-collapse [&_table]:w-full
              [&_th]:border [&_th]:border-gray-200 [&_th]:px-4 [&_th]:py-2 [&_th]:bg-gray-50 [&_th]:font-semibold
              [&_td]:border [&_td]:border-gray-200 [&_td]:px-4 [&_td]:py-2"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Divider */}
          <hr className="my-10 border-gray-200" />

          {/* Comments */}
          <BlogComments
            postSlug={post.slug}
            moderationNotice={moderationNotice}
          />
        </div>
      </div>
    </div>
  );
}
