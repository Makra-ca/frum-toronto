# Blog System Enhancements

**Date:** 2026-05-25
**Status:** Ready for implementation

---

## Overview

Three distinct improvements to the existing blog system:

1. **Bug Fix: Missing GET handler** in `/api/user/blog/[id]/route.ts` — the file exists and has PATCH/DELETE but the GET was already added (confirmed in code review). This spec documents what was verified and what still needs to happen for the admin-side bug.
2. **Bug Fix: Missing `pendingCommentsCount`** in the admin blog posts list API response — the admin blog page needs a count of comments awaiting moderation without a separate API call.
3. **Image Cropping** — Replace the basic file-picker cover image upload in `BlogPostEditor.tsx` with a crop-before-upload flow enforcing 16:9 aspect ratio, with dual live preview (card + hero).
4. **Homepage algorithm: blog-active businesses** — Allocate one homepage ad slot (banner + sidebar) to business owners who published a blog post in the last 30 days, so blogging is rewarded with free homepage exposure.
5. **CTAs driving blog adoption** — Show contextual banners to business owners on the dashboard and public blog listing page nudging them to write blog posts to earn the homepage slot.

---

## 1. Bug Fixes

### Bug Fix 1: Verify GET /api/user/blog/[id]

**Verified status:** The GET handler IS already present in `src/app/api/user/blog/[id]/route.ts` (lines 33–78). It correctly:
- Requires authentication
- Checks `post.authorId === userId` before returning
- Returns 404 if not found, 403 if not the owner

**No code change needed** for this bug. The original report was based on a stale read. Document this as resolved.

---

### Bug Fix 2: Add `pendingCommentsCount` to Admin Blog List

**File:** `src/app/api/admin/blog/route.ts`

**Problem:** The GET handler's `posts` query (lines 74–102) includes `commentCount` as a subquery but does NOT include `pendingCommentsCount`. The admin UI needs to show a badge for posts that have comments awaiting moderation without making a second API call.

**Change:** Add a second subquery to the existing `db.select()` call in the GET handler:

```typescript
// Add this field alongside commentCount in the .select() object:
pendingCommentsCount: sql<number>`(
  SELECT count(*) FROM blog_comments
  WHERE post_id = ${blogPosts.id}
    AND approval_status = 'pending'
    AND is_active = true
)`,
```

**Response shape after fix:**
```typescript
{
  posts: Array<{
    // ... existing fields ...
    commentCount: number,
    pendingCommentsCount: number,  // NEW
  }>,
  pagination: { ... }
}
```

**No schema migration needed** — this is a computed field from existing data.

---

## 2. New Components

### 2.1 `ImageUploadWithCrop`

**File:** `src/components/shared/ImageUploadWithCrop.tsx`

**Purpose:** A reusable client component that wraps file selection, cropping, and upload. Used in `BlogPostEditor.tsx` for cover images. Can be used elsewhere (e.g., business banner images in the future).

**npm dependency to install:**
```bash
npm install react-image-crop
```
Package: `react-image-crop` — MIT licensed, ~11kb gzipped, no additional dependencies. Provides `ReactCrop` component and `centerCrop` / `makeAspectCrop` utilities.

**Props interface:**
```typescript
interface ImageUploadWithCropProps {
  value: string | null;               // Current image URL (controlled)
  onChange: (url: string | null) => void;  // Called with Vercel Blob URL after upload
  aspectRatio?: number;               // Default: 16/9
  folder?: string;                    // Upload folder for /api/upload. Default: "blog"
  disabled?: boolean;
  label?: string;                     // Default: "Cover Image"
}
```

**Internal state:**
```typescript
const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);  // base64 or object URL before crop
const [crop, setCrop] = useState<Crop>();                               // react-image-crop Crop state
const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
const [isUploading, setIsUploading] = useState(false);
const [isCropping, setIsCropping] = useState(false);  // true while crop UI is open
const imgRef = useRef<HTMLImageElement>(null);
const canvasRef = useRef<HTMLCanvasElement>(null);   // hidden canvas for rendering crop
```

**Flow:**

1. User clicks upload area → `<input type="file" accept="image/*">` triggers
2. On file select: read file as data URL (`FileReader`), store in `rawImageSrc`, set `isCropping = true`
3. Render crop UI (modal or inline below the upload area — inline preferred to avoid modal-in-modal issues)
4. Initialize `crop` using `makeAspectCrop` + `centerCrop` from `react-image-crop` on image load so the crop box starts centered at 16:9
5. As user drags crop, `completedCrop` updates; live previews re-render via `useEffect` drawing to offscreen canvases
6. User clicks "Crop & Upload":
   - Draw `completedCrop` region from `imgRef` onto `canvasRef` (hidden, sized 1280×720 for consistency)
   - `canvasRef.current.toBlob(...)` → get cropped Blob
   - POST `FormData` with the blob to `/api/upload` with `folder=blog`
   - On success: call `onChange(data.url)`, clear `rawImageSrc`, set `isCropping = false`
7. User clicks "Cancel" during crop: clear `rawImageSrc`, set `isCropping = false`, no upload

**Crop UI layout (when `isCropping = true`):**
```
┌─────────────────────────────────────────────────────────────┐
│  [Cancel]                              [Crop & Upload]       │
├──────────────────────────┬──────────────────────────────────┤
│                          │  PREVIEWS                         │
│   ReactCrop component    │  ┌─────────────────────────────┐ │
│   (user drags handles)   │  │ Card preview (listing grid) │ │
│                          │  │ 320×180px, rounded, shadow  │ │
│                          │  └─────────────────────────────┘ │
│                          │  Label: "How it looks in listing" │
│                          │                                   │
│                          │  ┌─────────────────────────────┐ │
│                          │  │ Hero preview (post detail)  │ │
│                          │  │ Full width, ~160px tall     │ │
│                          │  └─────────────────────────────┘ │
│                          │  Label: "How it looks on post"   │
└──────────────────────────┴──────────────────────────────────┘
```

Both previews are `<canvas>` elements that re-draw whenever `completedCrop` changes (useEffect with drawImage).

**When NOT cropping (value is set):**
```
┌────────────────────────────────────┐
│  [existing image at 16:9]    [✕]  │
│  "Click to replace"               │
└────────────────────────────────────┘
```

**When NOT cropping (no value):**
```
┌────────────────────────────────────┐
│  [ImageIcon]                       │
│  Click to upload cover image       │
│  JPG, PNG, WebP • Max 4MB         │
└────────────────────────────────────┘
```

**Error handling:**
- File type validation: must be `image/jpeg`, `image/png`, or `image/webp` — show `toast.error`
- File size: client-side check `> 4MB` before even opening crop UI — show `toast.error`
- Upload failure: show `toast.error("Failed to upload image")`, keep crop UI open so user can retry

**Canvas export size:** Always export at 1280×720 (1280px wide, 720px tall, exactly 16:9). This gives consistent file dimensions regardless of original image size.

---

## 3. Modified Components

### 3.1 `BlogPostEditor.tsx`

**File:** `src/components/blog/BlogPostEditor.tsx`

**Change:** Replace the existing "Cover Image" section (lines 172–220) with the new `<ImageUploadWithCrop>` component.

**Before (simplified):**
```tsx
// Lines 84-118: handleCoverImageUpload function with direct fetch to /api/upload
// Lines 172-220: manual label/input/preview JSX
```

**After:**
```tsx
import { ImageUploadWithCrop } from "@/components/shared/ImageUploadWithCrop";

// Remove: handleCoverImageUpload function, isUploading state
// Keep: coverImageUrl state and setCoverImageUrl

// In JSX, replace the Cover Image Card with:
<ImageUploadWithCrop
  value={coverImageUrl}
  onChange={setCoverImageUrl}
  folder="blog"
  label="Cover Image"
/>
```

**Also update `handleSubmit` disabled condition:**
```tsx
// Remove: disabled={isLoading || isUploading}
// Replace with:
disabled={isLoading}
// isUploading is now internal to ImageUploadWithCrop
```

**Prop changes to `BlogPostEditorProps`:** Remove `isUploading` from internal dependencies (it was never a prop, so no interface change needed).

---

## 4. Modified API Routes

### 4.1 `/api/featured-businesses/route.ts`

**File:** `src/app/api/featured-businesses/route.ts`

**Current behavior:** Returns up to `limit` businesses that have a paid placement flag (`showInHomepageBanner` or `showInHomepageSidebar`) and a `bannerImageUrl`, in random order.

**New behavior:** Hybrid slot allocation — 2 slots from paid businesses, 1 slot from the most recently blog-active business (defined as: the business owner published or updated a blog post to `approvalStatus = 'approved'` within the last 30 days).

**Required imports to add:**
```typescript
import { blogPosts, users } from "@/lib/db/schema";
import { sql, gt, desc, ne } from "drizzle-orm";
```
(Note: `businesses` and `subscriptionPlans` already imported; add `blogPosts`, `users`, and missing operators.)

**New query logic:**

```typescript
// Step 1: Fetch up to 2 paid businesses (existing logic, limit reduced to 2)
const paidBusinesses = await db
  .select({ id, name, slug, tagline, bannerImageUrl, logoUrl })
  .from(businesses)
  .innerJoin(subscriptionPlans, eq(businesses.subscriptionPlanId, subscriptionPlans.id))
  .where(and(
    eq(businesses.approvalStatus, "approved"),
    eq(businesses.isActive, true),
    eq(placementColumn, true),
    isNotNull(businesses.bannerImageUrl),
  ))
  .orderBy(sql`RANDOM()`)
  .limit(2);

// Step 2: Find most recently blog-active business
// A business is "blog-active" if its owner (businesses.userId) published
// a post with approvalStatus = 'approved' in the last 30 days
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

// Get user IDs who have published blog posts recently
const recentBloggerUserIds = await db
  .selectDistinct({ userId: blogPosts.authorId })
  .from(blogPosts)
  .where(and(
    eq(blogPosts.approvalStatus, "approved"),
    eq(blogPosts.isActive, true),
    gt(blogPosts.publishedAt, thirtyDaysAgo),
  ));

let blogActiveBusiness: typeof paidBusinesses[0] | null = null;

if (recentBloggerUserIds.length > 0) {
  const userIds = recentBloggerUserIds.map((r) => r.userId);

  // Find a business owned by one of those users that has a bannerImageUrl
  // Exclude businesses already in paidBusinesses to avoid duplicates
  const paidIds = paidBusinesses.map((b) => b.id);

  const [candidate] = await db
    .select({ id, name, slug, tagline, bannerImageUrl, logoUrl })
    .from(businesses)
    .where(and(
      eq(businesses.approvalStatus, "approved"),
      eq(businesses.isActive, true),
      isNotNull(businesses.bannerImageUrl),
      sql`${businesses.userId} = ANY(${userIds})`,
      // Exclude already-selected paid businesses
      paidIds.length > 0
        ? sql`${businesses.id} NOT IN (${sql.join(paidIds.map(id => sql`${id}`), sql`, `)})`
        : sql`true`,
    ))
    .orderBy(sql`RANDOM()`)
    .limit(1);

  blogActiveBusiness = candidate ?? null;
}

// Step 3: Assemble final list
// Slot order: paid[0], paid[1], blogActive (if exists)
// If no blog-active business found, fetch a 3rd paid business to fill the gap
let result = [...paidBusinesses];
if (blogActiveBusiness) {
  result.push(blogActiveBusiness);
} else if (result.length < limit) {
  // Try to fill remaining slots with more paid businesses
  const extraPaid = await db
    .select({ id, name, slug, tagline, bannerImageUrl, logoUrl })
    .from(businesses)
    .innerJoin(subscriptionPlans, eq(businesses.subscriptionPlanId, subscriptionPlans.id))
    .where(and(
      eq(businesses.approvalStatus, "approved"),
      eq(businesses.isActive, true),
      eq(placementColumn, true),
      isNotNull(businesses.bannerImageUrl),
      result.length > 0
        ? sql`${businesses.id} NOT IN (${sql.join(result.map(b => sql`${b.id}`), sql`, `)})`
        : sql`true`,
    ))
    .orderBy(sql`RANDOM()`)
    .limit(limit - result.length);

  result = [...result, ...extraPaid];
}

// Shuffle final list so blog-active slot isn't always last
result = result.sort(() => Math.random() - 0.5);
```

**Response shape:** Unchanged — same `{ businesses, placement }` structure. Consumers (`HomepageBanner`, `HomepageSidebarAds`) require no changes.

**Note on `limit` param:** The `limit` query param still works as an upper bound. Default is 3. If caller requests `limit=3`, the result will be at most 3 items (2 paid + 1 blog-active, or 3 paid if no blog-active businesses exist).

---

### 4.2 `/api/admin/blog/route.ts` (GET handler)

**File:** `src/app/api/admin/blog/route.ts`

Add `pendingCommentsCount` to the select (see Bug Fix 2 above). No other changes to this file.

---

## 5. Homepage Algorithm

### Slot Allocation (Full Detail)

```
For each placement (banner, sidebar):

  Fetch up to 2 paid businesses (showInHomepageBanner/showInHomepageSidebar = true,
    approvalStatus = 'approved', isActive = true, bannerImageUrl IS NOT NULL)
  → ordered RANDOM()

  Find 1 blog-active business:
    - Query blogPosts WHERE approvalStatus = 'approved'
        AND isActive = true
        AND publishedAt > NOW() - INTERVAL 30 days
    - Get DISTINCT authorIds from matching posts
    - Find a business WHERE userId IN (those authorIds)
        AND approvalStatus = 'approved'
        AND isActive = true
        AND bannerImageUrl IS NOT NULL
        AND id NOT IN (already-selected paid businesses)
    - Pick 1 at RANDOM() if multiple qualify

  If blog-active business found:
    result = [paid[0], paid[1], blogActive]
    shuffle result
  Else:
    Fetch a 3rd paid business (excluding paid[0] and paid[1])
    result = [paid[0], paid[1], paid[2]]  (some may be missing if < 3 paid businesses)
```

### Tie-breaking

If a business owner has published multiple posts in the last 30 days, they still only occupy 1 slot. The `SELECT DISTINCT` on `authorId` handles deduplication at the user level, and `LIMIT 1` on the business query handles the case where one user owns multiple businesses.

### Slot label for UI

The component does not need to know which slot is "blog-active" vs "paid". All three businesses render identically in the carousel/sidebar. No visual indicator distinguishing organic from paid placement is added (to keep the UI clean and the algorithm opaque to end users).

---

## 6. User Flows

### 6.1 Blog Post Cover Image (with crop)

1. User opens `/dashboard/blog/new` or `/admin/programs/blog/new`
2. Clicks the Cover Image upload area
3. Selects a file — client validates type and size immediately (no API call yet)
4. Crop UI appears inline, replacing the upload area
5. Crop starts centered at 16:9 aspect ratio
6. User adjusts crop handles; both preview panels update in real time
7. User clicks "Crop & Upload"
8. Canvas renders the cropped region at 1280×720, converted to WebP blob
9. POST to `/api/upload` with `folder=blog`
10. On success: crop UI closes, image preview shown with remove button
11. User continues editing the post; `coverImageUrl` is set in form state

### 6.2 Business Owner Sees Dashboard CTA

1. Business owner logs in, lands on `/dashboard`
2. If `userBusinesses.length > 0` (user has at least one business): show blog CTA card
3. CTA: "Get featured on the homepage for free — publish a blog post this month"
4. CTA button: "Write a post" → `/dashboard/blog/new`
5. CTA only shows if user has a business; other users never see it

### 6.3 Business Owner Sees Blog Listing CTA

1. Any user visits `/blog`
2. If user is logged in AND has a business: show subtle banner below the category filter bar
3. Banner: "Have a business listing? Blog posts can get your business featured on the homepage."
4. Banner has "Write a post" link → `/dashboard/blog/new`
5. Anonymous visitors and users without businesses: banner not shown
6. Implementation: `BlogListing.tsx` fetches `/api/businesses/my-businesses` on mount (only if session exists), checks if array is non-empty

### 6.4 Blog-Active Business Appears in Homepage Ads

1. Business owner publishes a blog post → `publishedAt` set, `approvalStatus = 'approved'`
2. Within the next homepage load: `/api/featured-businesses` query finds the business
3. Business appears in banner carousel and/or sidebar ads alongside paid advertisers
4. Slot persists for 30 days from the most recent approved post's `publishedAt`
5. After 30 days without a new post, the organic slot is replaced by a paid business

---

## 7. Dashboard CTA Implementation

**File:** `src/app/(dashboard)/dashboard/page.tsx`

This is a server component. `userBusinesses` is already queried from the DB (lines 19–31). No new API call needed.

**Change:** Add a new card in the dashboard grid (after the existing "Business Upgrade Prompt" and "Business Summary" sections) that appears when `userBusinesses.length > 0`:

```tsx
{/* Blog CTA for business owners */}
{userBusinesses.length > 0 && (
  <div className="mb-6 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg shadow-lg p-6 text-white">
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        <div className="bg-white/20 rounded-lg p-3 shrink-0">
          <BookOpen className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">
            Get featured on the homepage — for free
          </h3>
          <p className="text-emerald-100 mt-1 text-sm">
            Publish a blog post this month and your business could appear
            in the homepage ads alongside paid advertisers.
          </p>
        </div>
      </div>
      <Link
        href="/dashboard/blog/new"
        className="flex items-center gap-2 bg-white text-emerald-700 px-4 py-2 rounded-lg font-medium hover:bg-emerald-50 transition-colors whitespace-nowrap shrink-0"
      >
        Write a post
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  </div>
)}
```

**Import to add:** `BookOpen` from `lucide-react`.

---

## 8. Blog Listing CTA Implementation

**File:** `src/components/blog/BlogListing.tsx`

This is a client component. The session is not directly available in client components — instead, fetch `/api/businesses/my-businesses` and use the result to conditionally show the banner.

**New state:**
```typescript
const [hasBusiness, setHasBusiness] = useState(false);
```

**New effect (fetch once on mount):**
```typescript
useEffect(() => {
  fetch("/api/businesses/my-businesses")
    .then((res) => {
      if (!res.ok) return null;
      return res.json();
    })
    .then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setHasBusiness(true);
      }
    })
    .catch(() => {}); // Silently ignore — unauthenticated users get 401
}, []);
```

**New JSX — insert between the category filter bar and the posts grid:**
```tsx
{hasBusiness && (
  <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-6 flex items-center justify-between gap-4">
    <p className="text-sm text-emerald-800">
      Have a business listing? Publishing blog posts can get your business
      featured on the homepage.
    </p>
    <Link
      href="/dashboard/blog/new"
      className="text-sm font-medium text-emerald-700 hover:text-emerald-900 whitespace-nowrap underline"
    >
      Write a post
    </Link>
  </div>
)}
```

**Note:** `/api/businesses/my-businesses` returns 401 for unauthenticated users. The catch block silently swallows this — `hasBusiness` stays `false` and the banner never renders for anonymous visitors. No session-checking boilerplate needed in the component.

---

## 9. Dependencies

| Package | Purpose | Install |
|---------|---------|---------|
| `react-image-crop` | Crop UI and utilities | `npm install react-image-crop` |

No other new dependencies. The canvas API is used directly (browser built-in). The existing `/api/upload` route handles the actual file storage.

**`react-image-crop` version note:** As of May 2026, version 11.x is current. Use the `ReactCrop` component with the `aspect` prop set to `16/9`. Import CSS: `import 'react-image-crop/dist/ReactCrop.css'` in the component file (or in `globals.css`).

---

## 10. Edge Cases

### Image Cropping

| Case | Handling |
|------|---------|
| User selects a GIF | Block at file type check — show error "GIF not supported for cover images. Use JPG, PNG, or WebP." |
| Image is smaller than 1280×720 | Allow crop — canvas will still export at 1280×720 (stretches if necessary). Warn user with a subtle note if source image is below 800px wide. |
| User cancels mid-upload (after clicking "Crop & Upload") | Not possible to abort a fetch in-flight cleanly; disable the cancel button while uploading, re-enable on error |
| User removes image and re-uploads | The old Vercel Blob URL is orphaned (no delete call). Acceptable for now — cover image storage cost is negligible. Flag as future cleanup task. |
| Crop box has zero width/height | "Crop & Upload" button stays disabled until `completedCrop` has `width > 0 && height > 0` |

### Homepage Algorithm

| Case | Handling |
|------|---------|
| No paid businesses with bannerImageUrl | Show only the blog-active slot (1 item) or nothing if also no blog-active businesses |
| No blog-active businesses | Fill all 3 slots with paid businesses |
| Blog-active business has no bannerImageUrl | Not eligible for organic slot — skip to next candidate (the query already filters `isNotNull(bannerImageUrl)`) |
| Same user owns a paid-placement business AND is blog-active | The business is returned in the paid query. The blog-active query excludes already-selected IDs, so it won't appear twice. Net result: this user's business gets one slot (the paid one). |
| Business owner's post is pending admin approval | Post is not yet `approvalStatus = 'approved'`, so it doesn't count toward the 30-day window. |
| `limit` param < 3 | Respect the limit. If `limit=1`, return only 1 business (whichever random selection comes first). |

### Blog Listing CTA

| Case | Handling |
|------|---------|
| User not logged in | `/api/businesses/my-businesses` returns 401, catch block fires, `hasBusiness` stays `false`, banner hidden |
| User logged in but no business | API returns empty array, `hasBusiness` stays `false`, banner hidden |
| API slow to respond | Banner appears after the fetch resolves — no loading state needed since it's a secondary UI element, not critical content |

---

## 11. Migration Notes

### Database

No schema changes required. All new functionality uses existing columns:
- `businesses.userId` (exists)
- `businesses.bannerImageUrl` (exists)
- `blogPosts.authorId` (exists)
- `blogPosts.approvalStatus` (exists)
- `blogPosts.publishedAt` (exists)
- `blogPosts.isActive` (exists)
- `blogComments.approvalStatus` (exists)

### No Drizzle Migration Needed

Run `npm run db:push` only if the schema file was touched. For this feature set, it is not touched. No migration files to generate.

### Admin Subscription Plans Tooltip

After implementation, add an informational tooltip to the `showInHomepageBanner` and `showInHomepageSidebar` checkboxes in the admin Subscription Plans page explaining the hybrid algorithm:

> "Paid placements appear in 2 of 3 homepage ad slots. The third slot is reserved for business owners who have published a blog post in the last 30 days — at no extra cost."

The admin plans page is at `src/app/(admin)/admin/subscription-plans/page.tsx`. Use a `TooltipProvider` + `Tooltip` from `@/components/ui/tooltip` (already in project via shadcn/ui).

### README for Algorithm

Create `docs/featured-businesses-algorithm.md` documenting:
- The 2 paid + 1 blog-active slot structure
- The 30-day window definition (based on `publishedAt`, not `updatedAt`)
- Fallback behavior (3 paid if no organic candidates)
- The `bannerImageUrl` requirement for all slots
- Why the organic slot uses random selection when multiple businesses qualify

---

## File Summary

| Action | File |
|--------|------|
| NEW | `src/components/shared/ImageUploadWithCrop.tsx` |
| MODIFY | `src/components/blog/BlogPostEditor.tsx` — replace cover image section |
| MODIFY | `src/app/api/admin/blog/route.ts` — add `pendingCommentsCount` to GET |
| MODIFY | `src/app/api/featured-businesses/route.ts` — hybrid slot algorithm |
| MODIFY | `src/app/(dashboard)/dashboard/page.tsx` — add blog CTA card |
| MODIFY | `src/components/blog/BlogListing.tsx` — add blog CTA banner |
| NEW | `docs/featured-businesses-algorithm.md` |
| NO CHANGE | `src/app/api/user/blog/[id]/route.ts` — GET handler already exists |
