# Blog System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a blog system where admins post freely, users submit for approval, and readers can comment with flexible moderation.

**Architecture:** New database tables (blog_posts, blog_comments, blog_categories) with Drizzle ORM. TipTap editor reused from newsletter system. Admin pages under Programs tab group, public pages at /blog, user dashboard at /dashboard/blog. Comment moderation via site_settings global default + per-post override.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM + Neon PostgreSQL, TipTap editor, NextAuth v5 JWT, Vercel Blob uploads, shadcn/ui, Zod validation

**Spec:** `docs/superpowers/specs/2026-03-18-blog-system-design.md`

---

## File Structure

### New Files

**Schema & Validation:**
- `src/lib/db/schema.ts` — Add blog_categories, blog_posts, blog_comments tables + canAutoApproveBlog on users
- `src/lib/validations/blog.ts` — Zod schemas for blog posts, comments, categories

**Admin Pages:**
- `src/app/(admin)/admin/programs/blog/page.tsx` — Blog post management table
- `src/app/(admin)/admin/programs/blog/new/page.tsx` — New post editor (full page)
- `src/app/(admin)/admin/programs/blog/[id]/edit/page.tsx` — Edit post editor
- `src/app/(admin)/admin/programs/blog/comments/page.tsx` — Pending comments queue

**Admin API:**
- `src/app/api/admin/blog/route.ts` — GET (list all posts), POST (create)
- `src/app/api/admin/blog/[id]/route.ts` — GET, PATCH, DELETE
- `src/app/api/admin/blog/comments/route.ts` — GET pending comments
- `src/app/api/admin/blog/comments/[id]/route.ts` — PATCH (approve/reject), DELETE
- `src/app/api/admin/blog/categories/route.ts` — GET, POST
- `src/app/api/admin/blog/categories/[id]/route.ts` — PATCH, DELETE

**Public Pages:**
- `src/app/(public)/blog/page.tsx` — Blog listing
- `src/app/(public)/blog/[slug]/page.tsx` — Post detail + comments

**Public API:**
- `src/app/api/blog/route.ts` — GET approved posts with pagination
- `src/app/api/blog/[slug]/route.ts` — GET single post
- `src/app/api/blog/[slug]/comments/route.ts` — GET comments, POST new comment
- `src/app/api/blog/categories/route.ts` — GET categories

**User Dashboard:**
- `src/app/(dashboard)/dashboard/blog/page.tsx` — User's posts list
- `src/app/(dashboard)/dashboard/blog/new/page.tsx` — Create post
- `src/app/(dashboard)/dashboard/blog/[id]/edit/page.tsx` — Edit own post

**User API:**
- `src/app/api/user/blog/route.ts` — GET own posts, POST new post
- `src/app/api/user/blog/[id]/route.ts` — PATCH, DELETE own post

**Shared Components:**
- `src/components/blog/BlogPostEditor.tsx` — Shared editor form (used by admin + dashboard)
- `src/components/blog/BlogComments.tsx` — Comments section for post detail page

### Modified Files

- `src/lib/db/schema.ts` — Add 3 tables + 1 column
- `src/lib/validations/content.ts` — (No changes — blog validations go in separate file)
- `src/lib/search/types.ts` — Add "blog" to SearchType
- `src/lib/search/fuzzy-search.ts` — Add searchBlog() function
- `src/app/api/search/suggestions/route.ts` — Add blog case
- `src/app/(admin)/admin/programs/layout.tsx` — Add Blog tab
- `src/lib/constants/navigation.ts` — Add Blog to Community dropdown

---

## Chunk 1: Database Schema + Validation

### Task 1: Add blog tables to database schema

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Add canAutoApproveBlog to users table**

In `src/lib/db/schema.ts`, find the users table definition (around line 46 where the other canAutoApprove fields are) and add:

```typescript
canAutoApproveBlog: boolean("can_auto_approve_blog").default(false),
```

- [ ] **Step 2: Add blog_categories table**

Add after the existing tables (before the `// MISC` section around line 576):

```typescript
// ============================================
// BLOG
// ============================================

export const blogCategories = pgTable("blog_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

- [ ] **Step 3: Add blog_posts table**

```typescript
export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  slug: varchar("slug", { length: 300 }).notNull().unique(),
  content: text("content").notNull(),
  contentJson: jsonb("content_json"),
  coverImageUrl: varchar("cover_image_url", { length: 500 }),
  excerpt: varchar("excerpt", { length: 500 }),
  authorId: integer("author_id").notNull().references(() => users.id),
  categoryId: integer("category_id").references(() => blogCategories.id, { onDelete: "set null" }),
  customCategory: varchar("custom_category", { length: 100 }),
  approvalStatus: varchar("approval_status", { length: 20 }).default("pending").notNull(),
  commentModeration: varchar("comment_moderation", { length: 20 }),
  viewCount: integer("view_count").default(0),
  publishedAt: timestamp("published_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_blog_posts_listing").on(table.approvalStatus, table.isActive, table.publishedAt),
  index("idx_blog_posts_author").on(table.authorId),
  index("idx_blog_posts_category").on(table.categoryId),
]);
```

- [ ] **Step 4: Add blog_comments table**

```typescript
export const blogComments = pgTable("blog_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => blogPosts.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  parentId: integer("parent_id"),
  approvalStatus: varchar("approval_status", { length: 20 }).default("pending").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_blog_comments_post").on(table.postId, table.approvalStatus, table.isActive),
  index("idx_blog_comments_author").on(table.authorId),
]);
```

Note: `parentId` is not a formal foreign key reference to avoid circular reference issues with Drizzle. The API enforces that parentId references a valid comment and limits nesting to 1 level.

- [ ] **Step 5: Push schema to database**

```bash
npm run db:push
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat: add blog database tables (posts, comments, categories)"
```

### Task 2: Create blog validation schemas

**Files:**
- Create: `src/lib/validations/blog.ts`

- [ ] **Step 1: Create validation file**

```typescript
// src/lib/validations/blog.ts
import { z } from "zod";

export const blogPostSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  content: z.string().min(1, "Content is required"),
  contentJson: z.any().optional().nullable(),
  coverImageUrl: z.string().max(500).optional().nullable().or(z.literal("")),
  excerpt: z.string().max(500).optional().nullable().or(z.literal("")),
  categoryId: z.number().optional().nullable(),
  customCategory: z.string().max(100).optional().nullable().or(z.literal("")),
  commentModeration: z.enum(["open", "approved"]).optional().nullable(),
});

export type BlogPostFormData = z.infer<typeof blogPostSchema>;

export const blogCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(2000),
  parentId: z.number().optional().nullable(),
});

export type BlogCommentFormData = z.infer<typeof blogCommentSchema>;

export const blogCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  displayOrder: z.number().optional(),
});

export type BlogCategoryFormData = z.infer<typeof blogCategorySchema>;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/validations/blog.ts
git commit -m "feat: add blog Zod validation schemas"
```

---

## Chunk 2: Admin Blog API Routes

### Task 3: Create admin blog post API routes

**Files:**
- Create: `src/app/api/admin/blog/route.ts`
- Create: `src/app/api/admin/blog/[id]/route.ts`

- [ ] **Step 1: Create GET/POST route for blog posts**

`src/app/api/admin/blog/route.ts`:
- GET: List all posts with pagination, filters (status, category, search). Join with users table for author name, blogCategories for category name. Include comment count via subquery. Order by createdAt desc.
- POST: Create new post. Validate with blogPostSchema. Generate slug from title using the same `getUniqueSlug` pattern (generate slug, check for duplicates, append counter). Admin posts: `approvalStatus: "approved"`, `publishedAt: new Date()`. Store both `content` (HTML) and `contentJson` (TipTap JSON).

Auth pattern:
```typescript
const session = await auth();
if (!session?.user || session.user.role !== "admin") {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

- [ ] **Step 2: Create GET/PATCH/DELETE route for single blog post**

`src/app/api/admin/blog/[id]/route.ts`:
- GET: Return single post by id (for editing — include contentJson)
- PATCH: Update post. If changing approvalStatus to "approved" and publishedAt is null, set publishedAt. Update slug if title changed.
- DELETE: Soft delete (set isActive: false)

Use `await params` pattern for Next.js 15+.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/blog/
git commit -m "feat: add admin blog post API routes"
```

### Task 4: Create admin blog categories API routes

**Files:**
- Create: `src/app/api/admin/blog/categories/route.ts`
- Create: `src/app/api/admin/blog/categories/[id]/route.ts`

- [ ] **Step 1: Create GET/POST route for categories**

`src/app/api/admin/blog/categories/route.ts`:
- GET: List all categories ordered by displayOrder, include post count per category
- POST: Create category. Validate with blogCategorySchema. Generate slug from name.

- [ ] **Step 2: Create PATCH/DELETE route for single category**

`src/app/api/admin/blog/categories/[id]/route.ts`:
- PATCH: Update name, displayOrder. Regenerate slug if name changed.
- DELETE: Delete category. Posts with this categoryId get set to null (ON DELETE SET NULL).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/blog/categories/
git commit -m "feat: add admin blog categories API routes"
```

### Task 5: Create admin blog comments API routes

**Files:**
- Create: `src/app/api/admin/blog/comments/route.ts`
- Create: `src/app/api/admin/blog/comments/[id]/route.ts`

- [ ] **Step 1: Create GET route for pending comments**

`src/app/api/admin/blog/comments/route.ts`:
- GET: List comments with filters (status: all/pending/approved/rejected). Join with users for author name, blogPosts for post title. Order by createdAt desc. Pagination.

- [ ] **Step 2: Create PATCH/DELETE route for single comment**

`src/app/api/admin/blog/comments/[id]/route.ts`:
- PATCH: Update approvalStatus (approve/reject)
- DELETE: Hard delete comment

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/blog/comments/
git commit -m "feat: add admin blog comments API routes"
```

---

## Chunk 3: Public Blog API Routes

### Task 6: Create public blog API routes

**Files:**
- Create: `src/app/api/blog/route.ts`
- Create: `src/app/api/blog/[slug]/route.ts`
- Create: `src/app/api/blog/[slug]/comments/route.ts`
- Create: `src/app/api/blog/categories/route.ts`

- [ ] **Step 1: Create public blog listing API**

`src/app/api/blog/route.ts`:
- GET: List approved, active posts. Pagination (page, limit params). Optional category filter. Join with users for author name (first + last), blogCategories for category name. Include approved comment count. Order by publishedAt desc.

No auth required.

- [ ] **Step 2: Create public single post API**

`src/app/api/blog/[slug]/route.ts`:
- GET: Return single approved, active post by slug. Join with users for author info, blogCategories for category. Increment viewCount. Return 404 if not found or not approved.

- [ ] **Step 3: Create public comments API**

`src/app/api/blog/[slug]/comments/route.ts`:
- GET: List approved, active comments for post. Join with users for commenter name. Return threaded (top-level + their replies). Order by createdAt asc.
- POST: Submit new comment. Auth required. Validate with blogCommentSchema. Enforce max nesting depth of 1 (if parentId is provided, check that parent comment has no parentId itself). Apply comment moderation logic:
  1. Admin user → auto-approve
  2. Post `commentModeration` is "open" → auto-approve
  3. Post `commentModeration` is "approved" → pending
  4. Post `commentModeration` is null → check site_settings `blog_comment_moderation`
  5. Default to "open" if no setting exists

- [ ] **Step 4: Create public categories API**

`src/app/api/blog/categories/route.ts`:
- GET: List all categories ordered by displayOrder. No auth required.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/blog/
git commit -m "feat: add public blog API routes with comment moderation"
```

---

## Chunk 4: User Dashboard Blog API Routes

### Task 7: Create user blog API routes

**Files:**
- Create: `src/app/api/user/blog/route.ts`
- Create: `src/app/api/user/blog/[id]/route.ts`

- [ ] **Step 1: Create GET/POST route for user's posts**

`src/app/api/user/blog/route.ts`:
- GET: List authenticated user's own posts (any status). Include category name. Order by createdAt desc.
- POST: Create new post. Validate with blogPostSchema. Generate slug. Check `canAutoApproveBlog` permission: if true, auto-approve + set publishedAt; otherwise set to pending. Store both content (HTML) and contentJson.

Auth required (any authenticated user).

- [ ] **Step 2: Create PATCH/DELETE route for user's post**

`src/app/api/user/blog/[id]/route.ts`:
- PATCH: Edit own post. Only allow if post belongs to user AND status is "pending" or "rejected". On edit, reset approvalStatus to "pending" (unless user has canAutoApproveBlog). Validate with blogPostSchema.
- DELETE: Soft delete own post (set isActive: false). Only if post belongs to user.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/user/blog/
git commit -m "feat: add user blog API routes with approval flow"
```

---

## Chunk 5: Shared Blog Components

### Task 8: Create the blog post editor component

**Files:**
- Create: `src/components/blog/BlogPostEditor.tsx`

- [ ] **Step 1: Create the shared editor component**

This component wraps the existing `NewsletterEditor` from `src/components/newsletter/NewsletterEditor.tsx` with blog-specific fields. It's used by both admin and user dashboard.

Props:
```typescript
interface BlogPostEditorProps {
  initialData?: BlogPostFormData & { id?: number };
  categories: { id: number; name: string }[];
  onSubmit: (data: BlogPostFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  isAdmin?: boolean; // Shows comment moderation dropdown when true
}
```

Layout:
- Title input (full width)
- Cover image upload button (uses existing `/api/upload` endpoint) + preview
- Category dropdown (predefined categories) + custom category text input shown when "Other/Custom" selected
- Excerpt textarea (3 rows)
- Comment moderation dropdown (only when `isAdmin` is true): "Use default", "Open", "Require approval"
- TipTap editor (NewsletterEditor component) — full width, main content area
- Action buttons: Save (draft/pending) / Publish (admin only) / Cancel

The component manages form state with `useState` and calls `onSubmit` with the form data.

- [ ] **Step 2: Commit**

```bash
git add src/components/blog/BlogPostEditor.tsx
git commit -m "feat: add shared BlogPostEditor component"
```

### Task 9: Create the blog comments component

**Files:**
- Create: `src/components/blog/BlogComments.tsx`

- [ ] **Step 1: Create the comments component**

Client component for displaying and submitting comments on a blog post detail page.

Props:
```typescript
interface BlogCommentsProps {
  postSlug: string;
  moderationNotice?: boolean; // Show "comment will appear after approval" notice
}
```

Features:
- Fetches comments from `GET /api/blog/[slug]/comments` on mount
- Renders threaded comments: top-level comments with their replies indented below
- Each comment shows: author name, relative time (e.g., "2 hours ago"), content
- Reply button on top-level comments (not on replies — max depth 1)
- "Add comment" textarea at top (only shown if user is logged in, otherwise show "Log in to comment" link)
- Reply form appears inline below a comment when reply button clicked
- Submit calls `POST /api/blog/[slug]/comments`
- If `moderationNotice` is true, show info banner: "Comments are moderated and will appear after approval"
- Use toast for success/error

- [ ] **Step 2: Commit**

```bash
git add src/components/blog/BlogComments.tsx
git commit -m "feat: add BlogComments component with threaded replies"
```

---

## Chunk 6: Admin Blog Pages

### Task 10: Add Blog tab to Programs layout

**Files:**
- Modify: `src/app/(admin)/admin/programs/layout.tsx`

- [ ] **Step 1: Add Blog tab**

Add to imports: `Newspaper` from lucide-react.

Add to programTabs array:
```typescript
{ href: "/admin/programs/blog", label: "Blog", icon: Newspaper },
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(admin)/admin/programs/layout.tsx
git commit -m "feat: add Blog tab to admin Programs group"
```

### Task 11: Create admin blog management page

**Files:**
- Create: `src/app/(admin)/admin/programs/blog/page.tsx`

- [ ] **Step 1: Create the admin blog page**

Client component with:
- "New Post" button → navigates to `/admin/programs/blog/new`
- "Categories" button → opens a Dialog for category CRUD (inline table with add/edit/delete, calls `/api/admin/blog/categories`)
- Global comment moderation toggle (fetches/updates `blog_comment_moderation` from site_settings via a dedicated endpoint or inline fetch to `/api/admin/settings`)
- Pending comments count badge linking to `/admin/programs/blog/comments`
- Posts table with columns: Title, Author, Status badge, Category, Published date, Comments count, Actions (Edit/Delete)
- Filters: status select (all/pending/approved/rejected), category select, search input with debounce
- Quick approve/reject buttons for pending posts
- Pagination

Follow the same patterns as other admin pages (useState, useEffect, fetch, toast, Dialog, AlertDialog).

API calls: `/api/admin/blog` for posts, `/api/admin/blog/categories` for categories, `/api/admin/blog/[id]` for approve/reject/delete.

- [ ] **Step 2: Commit**

```bash
git add src/app/(admin)/admin/programs/blog/page.tsx
git commit -m "feat: add admin blog management page"
```

### Task 12: Create admin blog post editor pages

**Files:**
- Create: `src/app/(admin)/admin/programs/blog/new/page.tsx`
- Create: `src/app/(admin)/admin/programs/blog/[id]/edit/page.tsx`

- [ ] **Step 1: Create new post page**

Client component that:
- Fetches categories from `/api/admin/blog/categories`
- Renders `BlogPostEditor` with `isAdmin={true}`
- On submit: POST to `/api/admin/blog`, then redirect to `/admin/programs/blog`
- On cancel: navigate back to `/admin/programs/blog`

- [ ] **Step 2: Create edit post page**

Client component that:
- Fetches post data from `/api/admin/blog/[id]` (uses `contentJson` to populate editor)
- Fetches categories from `/api/admin/blog/categories`
- Renders `BlogPostEditor` with `isAdmin={true}` and `initialData`
- On submit: PATCH to `/api/admin/blog/[id]`, then redirect to `/admin/programs/blog`
- On cancel: navigate back

- [ ] **Step 3: Commit**

```bash
git add src/app/(admin)/admin/programs/blog/new/ src/app/(admin)/admin/programs/blog/[id]/
git commit -m "feat: add admin blog post editor pages (new + edit)"
```

### Task 13: Create admin comments moderation page

**Files:**
- Create: `src/app/(admin)/admin/programs/blog/comments/page.tsx`

- [ ] **Step 1: Create pending comments page**

Client component with:
- Table of comments with columns: Comment excerpt (truncated), Post title, Author, Date, Actions (Approve/Reject/Delete)
- Status filter (all/pending/approved/rejected)
- Quick approve/reject buttons
- Fetches from `/api/admin/blog/comments`

- [ ] **Step 2: Commit**

```bash
git add src/app/(admin)/admin/programs/blog/comments/
git commit -m "feat: add admin blog comments moderation page"
```

---

## Chunk 7: Public Blog Pages

### Task 14: Create public blog listing page

**Files:**
- Create: `src/app/(public)/blog/page.tsx`

- [ ] **Step 1: Create blog listing page**

Server component with client-side filtering. Structure:
- Hero section with title "Blog" and subtitle
- Category filter bar (horizontal pills/buttons, fetched from `/api/blog/categories`)
- Grid of post cards (responsive: 1 col mobile, 2 col tablet, 3 col desktop)
- Each card: cover image (or placeholder gradient), title, excerpt, author name, published date, category badge, comment count
- Cards link to `/blog/[slug]`
- Pagination at bottom

SEO metadata:
```typescript
export const metadata = {
  title: "Blog | FrumToronto",
  description: "Articles, Torah thoughts, and community news from the Toronto Orthodox community",
};
```

Fetch initial posts server-side, then use client component for category filtering and pagination.

- [ ] **Step 2: Commit**

```bash
git add src/app/(public)/blog/
git commit -m "feat: add public blog listing page"
```

### Task 15: Create public blog post detail page

**Files:**
- Create: `src/app/(public)/blog/[slug]/page.tsx`

- [ ] **Step 1: Create post detail page**

Server component for the post content, with client BlogComments component below.

Layout:
- Cover image as full-width hero (if present)
- White card with post content:
  - Title (large heading)
  - Author info (name, published date)
  - Category badge
  - HTML content rendered from `content` column (use `dangerouslySetInnerHTML` — content is admin/TipTap generated HTML, safe)
  - Style the rendered HTML with Tailwind prose class (`prose prose-lg max-w-none`)
- BlogComments component below the post

SEO metadata with `generateMetadata`:
```typescript
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Fetch post title, excerpt, coverImageUrl
  return {
    title: `${post.title} | FrumToronto Blog`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: post.coverImageUrl ? [post.coverImageUrl] : [],
    },
  };
}
```

Determine comment moderation status for the post:
1. Check post.commentModeration
2. If null, fetch site_settings for blog_comment_moderation
3. Pass `moderationNotice={moderationIsOn}` to BlogComments

Return 404 (`notFound()`) if post not found or not approved.

- [ ] **Step 2: Commit**

```bash
git add src/app/(public)/blog/[slug]/
git commit -m "feat: add public blog post detail page with comments"
```

---

## Chunk 8: User Dashboard Blog Pages

### Task 16: Create user dashboard blog pages

**Files:**
- Create: `src/app/(dashboard)/dashboard/blog/page.tsx`
- Create: `src/app/(dashboard)/dashboard/blog/new/page.tsx`
- Create: `src/app/(dashboard)/dashboard/blog/[id]/edit/page.tsx`

- [ ] **Step 1: Create user's posts list page**

Client component:
- "Write a Post" button → navigates to `/dashboard/blog/new`
- Table/card list of user's own posts with: title, status badge (pending/approved/rejected), category, created date
- Edit button (only for pending/rejected posts)
- Delete button with confirmation
- Fetches from `/api/user/blog`

- [ ] **Step 2: Create user new post page**

Client component:
- Fetches categories from `/api/blog/categories`
- Renders `BlogPostEditor` with `isAdmin={false}` (hides comment moderation dropdown)
- On submit: POST to `/api/user/blog`, show toast, redirect to `/dashboard/blog`

- [ ] **Step 3: Create user edit post page**

Client component:
- Fetches post from `/api/user/blog/[id]` (only if user owns it)
- Fetches categories from `/api/blog/categories`
- Renders `BlogPostEditor` with `isAdmin={false}` and `initialData`
- On submit: PATCH to `/api/user/blog/[id]`, show toast, redirect to `/dashboard/blog`
- Show notice: "Editing will resubmit your post for approval"

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/dashboard/blog/
git commit -m "feat: add user dashboard blog pages (list, new, edit)"
```

---

## Chunk 9: Navigation + Search Integration

### Task 17: Add Blog to site navigation

**Files:**
- Modify: `src/lib/constants/navigation.ts`
- Modify: `src/app/(admin)/admin/programs/layout.tsx` (if not already done in Task 10)

- [ ] **Step 1: Add Blog to Community dropdown**

In `src/lib/constants/navigation.ts`, add Blog as the first item in the Community children array (line 58):

```typescript
children: [
  { label: "Blog", href: "/blog" },
  { label: "Simchas", href: "/simchas" },
  { label: "Shiva Notices", href: "/shiva" },
  { label: "Tehillim List", href: "/community/tehillim" },
],
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/constants/navigation.ts
git commit -m "feat: add Blog to Community navigation dropdown"
```

### Task 18: Add blog to fuzzy search system

**Files:**
- Modify: `src/lib/search/types.ts`
- Modify: `src/lib/search/fuzzy-search.ts`
- Modify: `src/app/api/search/suggestions/route.ts`

- [ ] **Step 1: Add blog to SearchType**

In `src/lib/search/types.ts`, add `"blog"` to the SearchType union:

```typescript
export type SearchType =
  | "businesses"
  | "classifieds"
  | "shuls"
  | "shiurim"
  | "events"
  | "ask-the-rabbi"
  | "blog"
  | "all";
```

- [ ] **Step 2: Add searchBlog function**

In `src/lib/search/fuzzy-search.ts`, add a `searchBlog()` function following the same pattern as `searchShiurim()`. Search fields: `title` and `excerpt`. Filter: `approvalStatus = 'approved'` AND `isActive = true`. URL: `/blog/${slug}`. Subtitle: category name or published date.

- [ ] **Step 3: Wire into suggestions API**

In `src/app/api/search/suggestions/route.ts`, add a case for `"blog"` that calls `searchBlog()`, and include blog results in the `"all"` case.

- [ ] **Step 4: Create trigram indexes**

Run a script or SQL to create GIN trigram indexes:
```sql
CREATE INDEX IF NOT EXISTS idx_blog_posts_title_trgm ON blog_posts USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_blog_posts_excerpt_trgm ON blog_posts USING gin (excerpt gin_trgm_ops);
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/search/types.ts src/lib/search/fuzzy-search.ts src/app/api/search/suggestions/route.ts
git commit -m "feat: add blog to universal fuzzy search system"
```

---

## Chunk 10: Verification + CLAUDE.md Update

### Task 19: Verify the full system

- [ ] **Step 1: Check all new files exist**

Verify these directories exist with page files:
```
src/app/(admin)/admin/programs/blog/
src/app/(admin)/admin/programs/blog/new/
src/app/(admin)/admin/programs/blog/[id]/edit/
src/app/(admin)/admin/programs/blog/comments/
src/app/(public)/blog/
src/app/(public)/blog/[slug]/
src/app/(dashboard)/dashboard/blog/
src/app/(dashboard)/dashboard/blog/new/
src/app/(dashboard)/dashboard/blog/[id]/edit/
src/app/api/admin/blog/
src/app/api/admin/blog/[id]/
src/app/api/admin/blog/categories/
src/app/api/admin/blog/categories/[id]/
src/app/api/admin/blog/comments/
src/app/api/admin/blog/comments/[id]/
src/app/api/blog/
src/app/api/blog/[slug]/
src/app/api/blog/[slug]/comments/
src/app/api/blog/categories/
src/app/api/user/blog/
src/app/api/user/blog/[id]/
src/components/blog/
```

- [ ] **Step 2: Run dev server and test**

```bash
npm run dev
```

Manual tests:
1. Admin: Navigate to Programs → Blog tab exists
2. Admin: Create a blog category
3. Admin: Create a blog post with TipTap editor
4. Public: Visit /blog → post appears in listing
5. Public: Click post → detail page with content renders
6. Public: Submit a comment (login first)
7. Dashboard: Visit /dashboard/blog → user can create a post
8. Dashboard: Post shows as pending
9. Admin: Approve the pending post
10. Public: Post now visible in listing

- [ ] **Step 3: Update CLAUDE.md with session notes**

Add a session note to CLAUDE.md documenting the blog system: tables added, key files, routes, and the comment moderation logic.
