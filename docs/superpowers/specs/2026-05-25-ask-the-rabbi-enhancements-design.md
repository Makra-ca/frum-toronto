# Ask the Rabbi Enhancements — Design Spec
**Date:** 2026-05-25  
**Status:** Ready for implementation

---

## 1. Overview

This spec covers six distinct enhancements to the Ask the Rabbi (ATR) feature:

1. **Threaded Comments** — Reddit-style 1-level comment threading on each ATR detail page, backed by a shared `<CommentThread>` component that replaces the existing `<BlogComments>` component too.
2. **Answer Notifications** — Email + in-app notification sent to the question submitter when their question is answered.
3. **canManageAskTheRabbi Permission** — Non-admin users who can fully manage ATR (publish, answer, edit, reject) from both admin and a dashboard section.
4. **Rabbi Quick-Post Shortcut** — A "Post New Answer" compose UI visible only to `canManageAskTheRabbi` users on the public `/ask-the-rabbi` page.
5. **Homepage Orbit Node Update** — Replace the "Community" orbit node with "Ask the Rabbi".
6. **Newsletter ATR Block** — A toggleable block in the newsletter composer that auto-pulls questions published in the last 7 days.
7. **Registration Page Update** — Update the member benefit copy to mention ATR comments.

---

## 2. Database Schema Changes

### 2.1 New table: `askTheRabbiComments`

```typescript
// src/lib/db/schema.ts

export const askTheRabbiComments = pgTable("ask_the_rabbi_comments", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id")
    .notNull()
    .references(() => askTheRabbi.id, { onDelete: "cascade" }),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  parentId: integer("parent_id").references((): AnyPgColumn => askTheRabbiComments.id, {
    onDelete: "cascade",
  }),
  approvalStatus: varchar("approval_status", { length: 20 })
    .default("approved")
    .notNull(), // approved | pending | rejected
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_atr_comments_question").on(table.questionId),
  index("idx_atr_comments_parent").on(table.parentId),
  index("idx_atr_comments_author").on(table.authorId),
  index("idx_atr_comments_status").on(table.approvalStatus),
]);
```

### 2.2 New columns on `users` table

```typescript
// Add to users table definition in src/lib/db/schema.ts

canManageAskTheRabbi: boolean("can_manage_ask_the_rabbi").default(false),
commentPermission: varchar("comment_permission", { length: 20 }).default("allowed").notNull(),
// Enum values: 'allowed' | 'moderated' | 'blocked'
```

**commentPermission semantics:**
- `allowed` — comment is immediately approved and visible
- `moderated` — comment inserted with `approvalStatus: 'pending'`; admin must approve before it appears
- `blocked` — API rejects comment submission with 403

### 2.3 New `notifications` table (in-app notifications)

```typescript
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(),
  // e.g. 'atr_answered', 'comment_approved'
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  linkUrl: varchar("link_url", { length: 500 }),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_notifications_user").on(table.userId),
  index("idx_notifications_read").on(table.isRead),
]);
```

### 2.4 Migration SQL

```sql
-- Run via db:push (schema change) or as a raw migration

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS can_manage_ask_the_rabbi BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS comment_permission VARCHAR(20) DEFAULT 'allowed' NOT NULL;

CREATE TABLE IF NOT EXISTS ask_the_rabbi_comments (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES ask_the_rabbi(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id INTEGER REFERENCES ask_the_rabbi_comments(id) ON DELETE CASCADE,
  approval_status VARCHAR(20) DEFAULT 'approved' NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_atr_comments_question ON ask_the_rabbi_comments(question_id);
CREATE INDEX IF NOT EXISTS idx_atr_comments_parent ON ask_the_rabbi_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_atr_comments_author ON ask_the_rabbi_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_atr_comments_status ON ask_the_rabbi_comments(approval_status);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  link_url VARCHAR(500),
  is_read BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
```

---

## 3. New Components

### 3.1 `CommentThread` (shared, replaces `BlogComments`)

**File:** `src/components/shared/CommentThread.tsx`

This is a generalized version of the existing `BlogComments` component. The current `BlogComments` is hardwired to `/api/blog/${postSlug}/comments`. `CommentThread` accepts the API base URL as a prop, making it reusable across ATR and blog.

```typescript
interface CommentThreadComment {
  id: number;
  content: string;
  authorName: string;
  parentId: number | null;
  createdAt: string;
  approvalStatus?: string;  // 'approved' | 'pending' | 'rejected'
}

interface CommentThreadProps {
  /**
   * Base URL for the comments API (no trailing slash).
   * GET {apiBase} → fetches list
   * POST {apiBase} → submits { content, parentId }
   */
  apiBase: string;

  /**
   * Whether to show the moderation notice banner.
   * Pass true when the site setting for comment moderation is on,
   * or when the current user's commentPermission is 'moderated'.
   */
  moderationNotice?: boolean;

  /**
   * Whether comments are allowed at all.
   * When false, renders a "Comments are disabled" message instead of the input.
   * Default: true
   */
  commentsEnabled?: boolean;

  /**
   * Optional label override for the section heading. Default: "Comments"
   */
  label?: string;
}
```

**Behaviour differences from `BlogComments`:**
- Accepts `apiBase` prop instead of `postSlug`
- Adds `commentsEnabled` guard: when false, renders a `<Card>` with "Comments are disabled for this post." instead of input area
- All other logic (optimistic insert for approved, pending toast, reply threading, relative time, keyboard accessibility) remains identical to `BlogComments`

**Reply depth:** 1 level only (replies cannot themselves be replied to — the Reply button is only rendered on top-level comments, identical to the blog pattern)

### 3.2 `AtrQuickPost` (rabbi compose widget)

**File:** `src/components/ask-the-rabbi/AtrQuickPost.tsx`

Visible only when the current session user has `canManageAskTheRabbi: true`. Renders at the top of the public `/ask-the-rabbi` page, above the category filters and question list.

```typescript
interface AtrQuickPostProps {
  /** Author display name pre-filled from session.user.name */
  authorName: string;
  /** Author image URL from session.user.image (optional) */
  authorImage?: string;
  /**
   * Called after successful post to refresh the question list on the page.
   * The parent server component passes router.refresh() via a client wrapper.
   */
  onPosted: () => void;
}
```

**Fields in the form:**
- `title` (required, max 255) — text input
- `question` (required, min 20 chars) — Textarea (the body/topic being addressed)
- `answer` (required, min 20 chars) — Textarea (the actual answer)
- `category` (optional) — free-text input (same as admin form)
- `answeredBy` (pre-filled with session user's name, editable) — text input

**Behaviour:**
- Submits to `POST /api/ask-the-rabbi/quick-post`
- On success: optimistically scrolls page back to question list, calls `onPosted()`, shows success toast "Answer posted"
- No approval queue — content is immediately `isPublished: true`, `publishedAt: now()`
- Form collapses by default, expanded by clicking "Post New Answer" button (toggle pattern, not a modal)

### 3.3 `AtrAnswerNotification` email template function

**File:** `src/lib/email/templates.ts` (add alongside existing templates)

Not a React component — a plain TypeScript function following the existing pattern in `templates.ts`.

```typescript
export function generateAtrAnswerNotificationEmail(params: {
  questionTitle: string;
  questionUrl: string;   // absolute URL: ${NEXT_PUBLIC_APP_URL}/ask-the-rabbi/${questionId}
  answeredBy: string;
  recipientName: string;
}): string
```

Returns HTML string. Use the same table-based layout as existing templates.

---

## 4. Modified Components

### 4.1 `BlogComments` → refactored to use `CommentThread`

**File:** `src/components/blog/BlogComments.tsx`

Replace the internal implementation with a thin wrapper that delegates to `CommentThread`:

```typescript
// BlogComments.tsx becomes:
export function BlogComments({ postSlug, moderationNotice = false }: BlogCommentsProps) {
  return (
    <CommentThread
      apiBase={`/api/blog/${postSlug}/comments`}
      moderationNotice={moderationNotice}
    />
  );
}
```

All existing behaviour is preserved because `CommentThread` replicates the current `BlogComments` logic exactly. Existing blog detail pages do not need changes.

### 4.2 `HeroSection` — orbit node update

**File:** `src/components/home/HeroSection.tsx`

In the `communityNodes` array (line 22), replace the `community` entry with `ask-the-rabbi`:

```typescript
// REMOVE:
{ id: "community", label: "Community", description: "Simchas & alerts", icon: Users, href: "/community", color: "from-pink-500 to-pink-600" },

// ADD:
{ id: "ask-the-rabbi", label: "Ask the Rabbi", description: "Torah Q&A", icon: BookMarked, href: "/ask-the-rabbi", color: "from-pink-500 to-pink-600" },
```

Import `BookMarked` from `lucide-react` (already available in the project). The `Users` import can be removed if no longer used elsewhere in the file (verify before removing).

**Node label:** "Ask the Rabbi" is long — it will render at `text-[8px]` at default size and `text-[10px]` on hover, which is the same as other nodes. This is acceptable given the existing node sizing behavior.

### 4.3 ATR detail page — add `CommentThread`

**File:** `src/app/(public)/ask-the-rabbi/[id]/page.tsx`

Add `CommentThread` below the answer section:

```typescript
// After the answer card, add:
<section className="mt-8">
  <CommentThread
    apiBase={`/api/ask-the-rabbi/${question.id}/comments`}
    moderationNotice={/* fetched from site settings or derived from session */}
  />
</section>
```

The detail page is currently a server component. The `CommentThread` is a client component — it can be imported directly (Next.js handles the boundary automatically).

The `moderationNotice` prop value: fetch `atr_comment_moderation` key from `siteSettings` table in the same server-side data fetch. Pass `true` if the setting value is `'moderated'`.

### 4.4 ATR list page — add `AtrQuickPost`

**File:** `src/app/(public)/ask-the-rabbi/page.tsx`

This page is currently a server component. Create a thin client wrapper to host `AtrQuickPost`:

```typescript
// src/components/ask-the-rabbi/AtrQuickPostWrapper.tsx
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AtrQuickPost } from "./AtrQuickPost";

export function AtrQuickPostWrapper() {
  const { data: session } = useSession();
  const router = useRouter();

  if (!session?.user?.canManageAskTheRabbi) return null;

  return (
    <AtrQuickPost
      authorName={session.user.name ?? ""}
      authorImage={session.user.image ?? undefined}
      onPosted={() => router.refresh()}
    />
  );
}
```

Add `canManageAskTheRabbi` to the NextAuth session type in `src/types/next-auth.d.ts`.

Place `<AtrQuickPostWrapper />` as the first element inside the page's `<main>` content area, above the filter/search bar.

### 4.5 Admin user management — new permission fields

**File:** `src/components/admin/UserTable.tsx` (or the permissions dialog within it)

In the permissions dialog (the shield icon button that opens a permission-editing dialog), add two new toggle rows:

| Toggle label | Field |
|---|---|
| Manage Ask the Rabbi | `canManageAskTheRabbi` |
| Comment permission | `commentPermission` (radio/select: Allowed / Moderated / Blocked) |

`commentPermission` should be a `<Select>` with three options, not a checkbox, since it's a 3-way enum.

**API:** The existing `PATCH /api/admin/users/[id]` route must be updated to accept and persist `canManageAskTheRabbi` and `commentPermission`.

### 4.6 Admin ATR page — answer-and-notify flow

**File:** `src/app/(admin)/admin/programs/rabbi/page.tsx`

When admin clicks "Publish" on a submission that already has an answer filled in (status transition to `answered`), the API call must trigger:
1. The `publishedQuestionId` to be set on the submission
2. The notification email to be sent
3. An in-app notification to be created (if submission has a `userId`)

No UI change needed in the admin page itself — the notification is a server-side side effect of the existing publish action. The admin page calls `POST /api/admin/ask-the-rabbi/submissions/[id]/answer` (new route — see section 6).

### 4.7 Register page — update member benefit copy

**File:** `src/app/(auth)/register/page.tsx`

Update the existing "Submit questions to Ask the Rabbi" benefit text:

```typescript
// BEFORE:
{ icon: MessageSquare, text: "Submit questions to Ask the Rabbi" },

// AFTER:
{ icon: MessageSquare, text: "Ask the Rabbi — submit questions and join the community discussion" },
```

### 4.8 Dashboard — ATR manager section

**File:** `src/app/(dashboard)/dashboard/ask-the-rabbi/page.tsx` (new page)

Users with `canManageAskTheRabbi: true` see a new "Ask the Rabbi" entry in their dashboard sidebar linking to this page.

The page renders a stripped-down version of the admin ATR management UI:
- Tabs: Published Q&A | Pending Submissions | Comments
- Published Q&A tab: table of published questions with Edit and Unpublish actions
- Pending Submissions tab: same as admin, with Accept (answer + publish) and Reject actions
- Comments tab: table of pending/flagged comments for ATR posts, with Approve/Delete actions

Access is gated server-side: if `session.user.canManageAskTheRabbi` is false, redirect to `/dashboard`.

### 4.9 Newsletter composer sidebar — ATR block toggle

**File:** `src/components/newsletter/NewsletterEditor.tsx` (or wherever the sidebar block toggles live — check this file before implementing)

Add a new sidebar block toggle: "Ask the Rabbi (last 7 days)".

When toggled on, the newsletter composer inserts a placeholder block (rendered in the preview area as a greyed card if no recent questions exist):

```
[Ask the Rabbi — Recent Q&A]
  Question 1 title → link
  Question 2 title → link
  ...
```

If no questions were published in the last 7 days, the placeholder renders greyed out with a tooltip: "No new questions published this week. This block will be omitted from the send."

**At send time**, the newsletter template generation function (`src/lib/email/newsletter-template.ts`) checks for this block in the content JSON, fetches questions published in the last 7 days from the DB, and substitutes real content (or omits the block if empty).

The block is identified in the TipTap JSON by a custom node type `atrRecentBlock`. If the newsletter has no `atrRecentBlock` node, the block is not rendered.

---

## 5. New API Routes

### 5.1 `GET /api/ask-the-rabbi/[id]/comments`

**File:** `src/app/api/ask-the-rabbi/[id]/comments/route.ts`

Returns all approved, active comments for a published question. No auth required.

**Response:**
```typescript
// Array of CommentThreadComment
[
  {
    id: number,
    content: string,
    authorName: string,   // users.firstName + " " + users.lastName
    parentId: number | null,
    createdAt: string,    // ISO
    approvalStatus: "approved"
  },
  ...
]
```

**Query:** 
- Filter: `questionId = id`, `approvalStatus = 'approved'`, `isActive = true`
- Order: `createdAt ASC` (chronological)
- Join `users` to get `firstName`, `lastName`

### 5.2 `POST /api/ask-the-rabbi/[id]/comments`

**File:** same route file as 5.1

Auth required (401 if not logged in).

**Request body:**
```typescript
{ content: string, parentId: number | null }
```

**Validation:**
- `content`: min 1, max 2000 chars (after trim)
- `parentId`: if provided, must reference a top-level comment on this question (no nested replies — parentId's own parentId must be null)
- Check `session.user.commentPermission`:
  - `blocked` → 403 `{ error: "You are not permitted to comment." }`
  - `allowed` → insert with `approvalStatus: 'approved'`
  - `moderated` → insert with `approvalStatus: 'pending'`
- Check question exists and `isPublished = true` (404 otherwise)

**Response:**
```typescript
{
  id: number,
  content: string,
  authorName: string,
  parentId: number | null,
  createdAt: string,
  approvalStatus: "approved" | "pending"
}
```

The `CommentThread` component checks `result.approvalStatus === 'approved'` to decide whether to optimistically add the comment to the visible list (identical to the existing blog comment pattern).

### 5.3 `POST /api/ask-the-rabbi/quick-post`

**File:** `src/app/api/ask-the-rabbi/quick-post/route.ts`

Auth required. Checks `session.user.canManageAskTheRabbi === true` (403 if not).

**Request body:**
```typescript
{
  title: string,        // min 1, max 255
  question: string,     // min 20
  answer: string,       // min 20
  category?: string,    // optional
  answeredBy?: string,  // defaults to session user's name
}
```

**Server actions:**
1. Generate next `questionNumber` (max existing + 1, or null if none exist — match existing admin logic)
2. Insert into `askTheRabbi` with `isPublished: true`, `publishedAt: now()`
3. Return the created record

**Response:** `201` with the created `askTheRabbi` record.

### 5.4 `POST /api/admin/ask-the-rabbi/submissions/[id]/answer`

**File:** `src/app/api/admin/ask-the-rabbi/submissions/[id]/answer/route.ts`

Admin or `canManageAskTheRabbi` required.

**Request body:**
```typescript
{
  title: string,
  question: string,      // may be edited from original submission
  answer: string,
  category?: string,
  answeredBy?: string,
}
```

**Server actions (in order):**
1. Fetch submission by `id`; 404 if not found
2. Check `submission.status !== 'answered'` to prevent duplicate processing
3. Insert into `askTheRabbi` (published immediately)
4. Update submission: `status: 'answered'`, `publishedQuestionId: newQuestion.id`, `reviewedAt: now()`, `reviewedBy: session.user.id`
5. If `submission.userId` exists: insert into `notifications` table (`type: 'atr_answered'`)
6. Send email to `submission.email` using `generateAtrAnswerNotificationEmail()`
   - Wrap in try/catch — log error but do not fail the request if email fails
7. Return `{ question: newQuestion, submission: updatedSubmission }`

**Note:** Email sending must be awaited (serverless environment — see global CLAUDE.md rules).

### 5.5 `POST /api/admin/ask-the-rabbi/comments/[id]/approve`

**File:** `src/app/api/admin/ask-the-rabbi/comments/[id]/approve/route.ts`

Admin or `canManageAskTheRabbi` required.

Sets `approvalStatus: 'approved'` on the comment. Returns the updated comment.

### 5.6 `DELETE /api/admin/ask-the-rabbi/comments/[id]`

**File:** `src/app/api/admin/ask-the-rabbi/comments/[id]/route.ts`

Admin or `canManageAskTheRabbi` required.

Sets `isActive: false` (soft delete). Returns `{ success: true }`.

### 5.7 `GET /api/admin/ask-the-rabbi/comments`

**File:** `src/app/api/admin/ask-the-rabbi/comments/route.ts`

Admin or `canManageAskTheRabbi` required.

**Query params:** `status` (pending | approved | all, default: pending), `page`, `limit`

Returns paginated comment list with `questionTitle`, `authorName`, `content`, `approvalStatus`, `createdAt`.

---

## 6. Modified API Routes

### 6.1 `PATCH /api/admin/users/[id]`

**File:** `src/app/api/admin/users/[id]/route.ts`

Add `canManageAskTheRabbi` (boolean) and `commentPermission` (enum string) to the accepted and persisted fields. Add Zod validation for `commentPermission` as `z.enum(['allowed', 'moderated', 'blocked'])`.

### 6.2 Newsletter send — ATR block substitution

**File:** `src/app/api/admin/newsletters/[id]/send/route.ts` (or wherever the HTML generation happens before batch send)

Before calling `generateNewsletterHtml()`, check if the newsletter's `contentJson` contains a node of type `atrRecentBlock`. If yes:

1. Query `askTheRabbi` where `isPublished = true` AND `publishedAt >= now() - interval '7 days'`, ordered by `publishedAt DESC`, limit 5
2. If results exist: render an HTML block with question titles and links, substitute into template
3. If no results: remove the `atrRecentBlock` node entirely (do not render an empty section in the sent email)

---

## 7. User Flows

### 7.1 Logged-in user commenting on an ATR answer

1. User navigates to `/ask-the-rabbi/[id]`
2. Sees answer + comment section below
3. If `commentPermission = 'blocked'`: sees "You are not permitted to comment" message instead of textarea
4. Types comment, clicks "Post Comment"
5. If `commentPermission = 'allowed'`: comment appears immediately in list
6. If `commentPermission = 'moderated'`: toast "Your comment has been submitted for approval"; comment does not appear until approved

### 7.2 Logged-out user on ATR detail page

Same as blog: sees comment list, sees "Log in to comment" card instead of input area.

### 7.3 Admin or `canManageAskTheRabbi` user publishing an answer to a submission

1. In admin panel (`/admin/programs/rabbi`) or dashboard (`/dashboard/ask-the-rabbi`): opens a pending submission
2. Fills in Title, edits Question if needed, writes Answer, selects Category, confirms Answered By
3. Clicks "Publish Answer"
4. `POST /api/admin/ask-the-rabbi/submissions/[id]/answer` called
5. Q&A record created and published
6. Submission status updated to `answered`
7. Email sent to submitter
8. In-app notification created (if submitter has userId)
9. Admin sees success toast, submission moves to "Answered" tab

### 7.4 `canManageAskTheRabbi` user quick-posting from the public page

1. User visits `/ask-the-rabbi`
2. Sees "Post New Answer" button at top (only visible to them)
3. Clicks button — compose form expands inline
4. Fills in Title, Question topic, Answer content; optionally sets Category and Answered By
5. Clicks "Publish" — form collapses, page refreshes, new Q&A appears at top of list

### 7.5 Admin moderating ATR comments

1. Visits `/admin/programs/rabbi` (comments tab) or `/dashboard/ask-the-rabbi` (comments tab)
2. Sees pending comments list
3. Clicks "Approve" → comment becomes visible on public page
4. Clicks "Delete" → comment soft-deleted, never shown publicly

### 7.6 Submitter receiving answer notification

1. User submitted a question via `SubmitQuestionModal`
2. Admin or rabbi-manager publishes an answer linked to that submission
3. Email arrives at `submission.email`: "Your question has been answered"
4. If user has an account (userId exists): in-app notification appears in their notification bell (future dashboard notification center)

---

## 8. Email Templates

### 8.1 ATR Answer Notification Email

**Function:** `generateAtrAnswerNotificationEmail()` in `src/lib/email/templates.ts`

**Subject line:** `Your question has been answered — FrumToronto`

**HTML structure (table-based, inline styles):**

```
[FrumToronto header — matches existing template header style]

Your question has been answered!

Hi [recipientName],

Great news! The rabbi has answered your question on FrumToronto.

[Box]
  "[questionTitle]"
[/Box]

[Button: View the Answer → questionUrl]

Answered by: [answeredBy]

If you have more questions, you can always submit a new one at frumtoronto.com/ask-the-rabbi.

[Standard footer with unsubscribe — note: this is a transactional email, 
no unsubscribe link needed since it's reply to a user action, 
but include standard FrumToronto footer branding]
```

Use the same `#1e40af` header color, Urbanist font stack, and table layout as existing templates. The "View the Answer" button should use `background: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;`.

---

## 9. Permission Matrix

| Action | `member` | `content_contributor` | `canManageAskTheRabbi` | `admin` |
|---|---|---|---|---|
| View published Q&A | Yes | Yes | Yes | Yes |
| Submit a question | Yes (via modal) | Yes | Yes | Yes |
| Post comment (`allowed`) | Yes | Yes | Yes | Yes |
| Post comment (`moderated`) | Pending | Pending | **Approved** | **Approved** |
| Post comment (`blocked`) | No | No | N/A | N/A |
| Quick-post answer on public page | No | No | Yes | Yes |
| Publish/answer submissions (admin UI) | No | No | Yes | Yes |
| Reject submissions | No | No | Yes | Yes |
| Edit published Q&A | No | No | Yes | Yes |
| Approve/delete ATR comments | No | No | Yes | Yes |
| Set `canManageAskTheRabbi` on users | No | No | No | Yes |
| Set `commentPermission` on users | No | No | No | Yes |

**Note on comment moderation for `canManageAskTheRabbi` users:** These users' comments are always auto-approved regardless of their `commentPermission` setting, because they are trusted managers. Enforce this in `POST /api/ask-the-rabbi/[id]/comments` by checking `canManageAskTheRabbi` before checking `commentPermission`.

---

## 10. Edge Cases & Validation

### Comments
- **Max depth:** Enforce 1-level threading server-side. If `parentId` is provided, verify that the parent comment itself has `parentId IS NULL`. Return 400 if not.
- **Empty content:** Trim before validation; min 1 character after trim.
- **Question not published:** Return 404 if `isPublished = false` on the question. Don't leak unpublished Q&A existence.
- **Deleted parent:** If a parent comment is soft-deleted (`isActive = false`), replies referencing it still display (orphaned replies show under their parent even if parent is hidden — this is acceptable for v1; revisit if needed).
- **Rapid submission:** No explicit rate limiting in v1; rely on network latency and UI button disable state. Add DB-level rate limiting in a future iteration.

### Quick-post
- **Concurrent question number assignment:** Generate `questionNumber` as `SELECT MAX(question_number) + 1` inside the same INSERT transaction (or use a DB sequence). Do not compute it in application code outside the transaction.
- **Empty answeredBy:** Default to `session.user.firstName + " " + session.user.lastName`. Never send an empty string — fall back to `"FrumToronto Rabbi"` if name fields are null.

### Answer notification email
- **Missing email:** `submission.email` is non-nullable in schema, so this should always be present. Log a warning and skip email if somehow empty.
- **Email failure:** Catch the error, log `[ATR NOTIFY] Email failed for submission ${id}:`, but return 200 with the published question data. Do not fail the publish action because of an email error.
- **Duplicate answer attempt:** Check `submission.status === 'answered'` before processing. Return 409 `{ error: "This submission has already been answered." }` if already answered.

### Newsletter ATR block
- **Empty week:** If no questions in last 7 days, the block is completely omitted from the sent email HTML. Do not render an empty or greyed-out section in the actual email.
- **Block in plaintext version:** Also omit from plaintext version if no questions, or include question titles with absolute URLs if questions exist.

### Orbit node
- The `communityNodes` array has exactly 8 nodes. Replacing one node with another maintains the count — no orbit geometry changes needed.
- "Ask the Rabbi" label is 14 characters, which is the longest in the array. Verify it doesn't overflow the node card at `text-[8px]` — at that size, 14 chars on one line is ~56px wide, and the node card is 56px wide at default. If it wraps badly, use "Ask Rabbi" as the label fallback (7 chars).

---

## 11. Migration Notes

### Schema migration approach
Use `npm run db:push` for development. For production, generate a migration file with `npm run db:generate` and review before applying.

### NextAuth session type augmentation
Add `canManageAskTheRabbi: boolean` to `src/types/next-auth.d.ts` under `Session["user"]`. Also add `commentPermission: string` if needed client-side (it's used in the API, not necessarily in client components).

Update `src/lib/auth/auth.ts` JWT callback to include `canManageAskTheRabbi` from the DB user record, same pattern as `isTrusted`:
```typescript
// In jwt callback, after fetching dbUser:
token.canManageAskTheRabbi = dbUser?.canManageAskTheRabbi ?? false;

// In session callback:
session.user.canManageAskTheRabbi = token.canManageAskTheRabbi;
```

### Blog refactor — zero regression risk
`BlogComments` becomes a thin wrapper. The `CommentThread` component contains the same logic, just generalized. Run the blog comment flow manually after the refactor to confirm no regressions.

### Newsletter ATR block — TipTap custom node
The `atrRecentBlock` TipTap node type needs to be registered in the editor extensions used by `NewsletterEditor.tsx`. It is a non-editable block node (like an embed). Render it as a placeholder card in the editor, not actual fetched data (data is fetched at send time server-side).

### Dashboard sidebar
Add "Ask the Rabbi" link to the dashboard sidebar nav, visible only when `session.user.canManageAskTheRabbi === true`. Check how the existing dashboard sidebar is implemented and add conditional rendering matching that pattern.

### Site settings key
Add `atr_comment_moderation` key to `siteSettings` table (value: `'open'` or `'moderated'`). Default is `'open'`. The admin settings page can expose this toggle if desired (out of scope for this sprint — the DB key is enough for the moderationNotice prop logic).

---

## 12. Implementation Order (Suggested)

1. DB schema changes + `npm run db:push`
2. Update NextAuth JWT/session callbacks for `canManageAskTheRabbi`
3. Build `CommentThread` shared component
4. Refactor `BlogComments` to use `CommentThread`
5. Add ATR comment API routes (5.1, 5.2)
6. Add `CommentThread` to ATR detail page
7. Build `AtrQuickPost` component + `POST /api/ask-the-rabbi/quick-post`
8. Add `AtrQuickPostWrapper` to ATR list page
9. Build `POST /api/admin/ask-the-rabbi/submissions/[id]/answer` with notification logic
10. Add email template function
11. Update admin user management permissions dialog
12. Build dashboard ATR manager section + admin comment moderation routes
13. Update homepage orbit node
14. Update register page benefit copy
15. Newsletter ATR block (TipTap custom node + send-time substitution)
