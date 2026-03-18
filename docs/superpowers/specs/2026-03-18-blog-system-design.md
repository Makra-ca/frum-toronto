# Blog System

## Problem

The site has no blog functionality. The community needs a place for admins and users to publish articles, Torah thoughts, community news, etc. with the ability for readers to comment.

## Solution

A blog system where admins post freely and users submit posts for admin approval. Rich text editing via TipTap (already in project). Comments with flexible moderation — global default setting with per-post override.

## Database Schema

### `blog_categories`

```
id              serial PRIMARY KEY
name            varchar(100) NOT NULL
slug            varchar(100) NOT NULL UNIQUE
displayOrder    integer DEFAULT 0
createdAt       timestamp DEFAULT now()
updatedAt       timestamp DEFAULT now()
```

### `blog_posts`

```
id                  serial PRIMARY KEY
title               varchar(300) NOT NULL
slug                varchar(300) NOT NULL UNIQUE
content             text NOT NULL              -- rendered HTML for public display
contentJson         jsonb                      -- TipTap JSON for editor
coverImageUrl       varchar(500)               -- optional hero image
excerpt             varchar(500)               -- short summary for listing cards
authorId            integer NOT NULL REFERENCES users(id)
categoryId          integer REFERENCES blog_categories(id) ON DELETE SET NULL
customCategory      varchar(100)               -- free-form category if not using predefined
approvalStatus      varchar(20) DEFAULT 'pending'  -- pending, approved, rejected
commentModeration   varchar(20)                -- null = use global default, 'open', 'approved'
viewCount           integer DEFAULT 0
publishedAt         timestamp                  -- set when first approved
isActive            boolean DEFAULT true
createdAt           timestamp DEFAULT now()
updatedAt           timestamp DEFAULT now()
```

**Indexes:**
- `(approvalStatus, isActive, publishedAt DESC)` — public listing query
- `authorId` — user's own posts
- `categoryId` — category filter

### `blog_comments`

```
id                  serial PRIMARY KEY
postId              integer NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE
authorId            integer NOT NULL REFERENCES users(id)
content             text NOT NULL              -- plain text, HTML-escaped on render to prevent XSS
parentId            integer REFERENCES blog_comments(id) ON DELETE CASCADE  -- one level of replies only
approvalStatus      varchar(20) DEFAULT 'pending'  -- pending, approved, rejected
isActive            boolean DEFAULT true
createdAt           timestamp DEFAULT now()
updatedAt           timestamp DEFAULT now()
```

**Threading:** Max depth of 1 — users can reply to top-level comments but not to replies. The API enforces this by rejecting comments where `parentId` references a comment that itself has a `parentId`.

**Indexes:**
- `(postId, approvalStatus, isActive)` — loading comments for a post
- `authorId` — user's own comments

### Users Table Addition

Add to existing users table:
```
canAutoApproveBlog  boolean DEFAULT false
```

This extends the existing per-field auto-approve permissions (`canAutoApproveShiva`, `canAutoApproveTehillim`, etc.).

### Site Settings Entry

Key: `blog_comment_moderation`
Value: `"open"` (default) or `"approved"`

Stored in existing `site_settings` table (key-value store).

### Email Notifications

Blog posts do NOT trigger email notifications to subscribers. The blog is a browse-at-your-pace feature, not a time-sensitive alert. This keeps the notification system focused on urgent community content (alerts, shiva, tehillim, etc.).

## Validation Schemas

Add to `src/lib/validations/content.ts`:

```typescript
export const blogPostSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  content: z.string().min(1, "Content is required"),
  contentJson: z.any().optional(),
  coverImageUrl: z.string().max(500).optional().nullable(),
  excerpt: z.string().max(500).optional().nullable(),
  categoryId: z.number().optional().nullable(),
  customCategory: z.string().max(100).optional().nullable(),
  commentModeration: z.enum(["open", "approved"]).optional().nullable(),
});

export const blogCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(2000),
  parentId: z.number().optional().nullable(),
});

export const blogCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  displayOrder: z.number().optional(),
});
```

## Comment Moderation Logic

When a user submits a comment on a post:

1. If the user is an admin → auto-approve, skip all checks
2. Check the post's `commentModeration` field:
   - If `"open"` → auto-approve
   - If `"approved"` → set status to pending
   - If `null` → fall back to step 3
3. Check `site_settings` for `blog_comment_moderation`:
   - If `"open"` → auto-approve
   - If `"approved"` → set status to pending

## Routes

### Public Pages

**`/blog`** — Blog listing page
- Grid of approved, active posts ordered by publishedAt desc
- Category filter (top filter bar)
- Pagination
- Each card shows: cover image, title, excerpt, author name, date, category badge, comment count
- Lives under Community dropdown in site navigation
- SEO: `generateMetadata()` with page title "Blog | FrumToronto"

**`/blog/[slug]`** — Post detail page
- Cover image (if present) as hero
- Title, author info, published date, category badge
- HTML content rendered from `content` column (no TipTap bundle needed on public pages)
- Comments section below:
  - Shows approved comments (threaded — top-level + one level of replies)
  - "Add comment" form (login required)
  - Reply button on each top-level comment
  - If moderation is on, show notice: "Your comment will appear after approval"
- SEO: `generateMetadata()` with post title, excerpt as description, coverImageUrl as og:image

### Admin Pages

**`/admin/programs/blog`** — Blog management (new tab in Programs group)
- Table of all posts with: title, author, status badge, category, published date, comment count
- Filters: status (all/pending/approved/rejected), category, search
- Quick approve/reject for pending posts
- "New Post" button → navigates to editor page
- "Categories" button → opens dialog to manage blog categories (CRUD)
- "Comment Moderation" toggle visible on this page — quick access to the global setting
- Pending comments section/count visible

**`/admin/programs/blog/new`** — New post editor (full page)
- Title input
- Cover image upload (via existing `/api/upload` Vercel Blob endpoint)
- Category dropdown (predefined) + optional custom category text input
- TipTap rich text editor for content (reuse newsletter editor components)
- Excerpt textarea
- Comment moderation per-post: dropdown with "Use default", "Open", "Require approval"
- Save / Publish buttons

**`/admin/programs/blog/[id]/edit`** — Edit post editor (full page, same as new)

**`/admin/programs/blog/comments`** — Pending comments queue
- List of pending comments across all posts with quick approve/reject

### User Dashboard

**`/dashboard/blog`** — User's blog posts
- List of user's own posts with status badges (pending/approved/rejected)
- "New Post" button → navigates to editor page
- Edit own pending/rejected posts (editing resets status to pending for re-review)
- Cannot edit approved posts

**`/dashboard/blog/new`** — New post editor (same TipTap editor, without admin-only fields like comment moderation override)

**`/dashboard/blog/[id]/edit`** — Edit own post

### API Routes

**Public:**
- `GET /api/blog` — list approved posts with pagination, category filter
- `GET /api/blog/[slug]` — single post detail (increments viewCount)
- `GET /api/blog/[slug]/comments` — list approved comments for a post (threaded)
- `POST /api/blog/[slug]/comments` — submit comment (auth required, enforces moderation logic + max depth)
- `GET /api/blog/categories` — list categories

**Admin:**
- `GET /api/admin/blog` — list all posts (any status)
- `POST /api/admin/blog` — create post (auto-approved for admin)
- `GET /api/admin/blog/[id]` — get single post for editing
- `PATCH /api/admin/blog/[id]` — update post (approve/reject/edit)
- `DELETE /api/admin/blog/[id]` — soft delete post (set isActive: false)
- `GET /api/admin/blog/comments` — list pending comments across all posts
- `PATCH /api/admin/blog/comments/[id]` — approve/reject comment
- `DELETE /api/admin/blog/comments/[id]` — delete comment
- `GET /api/admin/blog/categories` — list categories
- `POST /api/admin/blog/categories` — create category
- `PATCH /api/admin/blog/categories/[id]` — update category
- `DELETE /api/admin/blog/categories/[id]` — delete category (sets posts' categoryId to null)

**User dashboard:**
- `GET /api/user/blog` — list user's own posts
- `POST /api/user/blog` — submit new post (status: pending, or approved if canAutoApproveBlog)
- `PATCH /api/user/blog/[id]` — edit own pending/rejected post (resets status to pending)
- `DELETE /api/user/blog/[id]` — soft delete own post

## Post Approval Flow

1. **Admin creates post** → `approvalStatus: "approved"`, `publishedAt: new Date()`
2. **User creates post** → `approvalStatus: "pending"`, `publishedAt: null`
3. **User with `canAutoApproveBlog`** → `approvalStatus: "approved"`, `publishedAt: new Date()`
4. **Admin approves user post** → `approvalStatus: "approved"`, `publishedAt: new Date()` (set on first approval only — subsequent edits don't change it)
5. **Admin rejects user post** → `approvalStatus: "rejected"`, author can edit and resubmit
6. **User edits rejected post** → `approvalStatus` resets to `"pending"` for re-review

## Slug Generation

Use the same `getUniqueSlug()` pattern already in the codebase — generate from title, append counter if duplicate exists.

## Admin Sidebar Update

Add "Blog" as a 6th tab in the Programs group layout (`src/app/(admin)/admin/programs/layout.tsx`):

```
Events | Shiurim | Ask the Rabbi | Classifieds | Specials | Blog
```

Route: `/admin/programs/blog`

## Navigation

Add "Blog" as the first item in the **Community** dropdown in the site header (before Simchas). Blog will likely be the most frequently accessed community feature.

## TipTap Editor

Reuse the existing TipTap editor components from `src/components/newsletter/`. The editor is already configured for rich text with images, headings, links, YouTube embeds, text alignment, colors, etc.

### Dual Content Storage

Following the newsletter pattern, blog posts store both:
- `content` (text) — pre-rendered HTML, used on public pages for fast rendering without loading TipTap
- `contentJson` (JSONB) — TipTap JSON, loaded back into the editor when editing

On save, the API receives both the HTML output and JSON state from the editor and stores both.

## Fuzzy Search Integration

Add `"blog"` as a new search type in the universal fuzzy search system:
- Search fields: `title`, `excerpt`
- Visibility filter: `approvalStatus = 'approved'` AND `isActive = true`
- Add trigram GIN indexes on `blog_posts(title)` and `blog_posts(excerpt)`
- Add to `SearchType` union in `src/lib/search/types.ts`
- Add query builder in `src/lib/search/fuzzy-search.ts`
- Result links to `/blog/[slug]`

## Unchanged

- Existing API routes, pages, and components are not modified (except adding the Blog tab to Programs layout, Blog link to Community nav dropdown, and blog search type to fuzzy search)
- Existing TipTap components are reused, not duplicated
- No email notification system changes
