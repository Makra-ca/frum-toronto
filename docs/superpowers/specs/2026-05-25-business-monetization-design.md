# Business Monetization Enhancements — Design Spec
**Date:** 2026-05-25
**Status:** Ready for implementation

---

## 1. Overview

Five enhancements to the FrumToronto business monetization system:

1. **Ads link to website** — Homepage banner and sidebar ads click out to the business's own website when available, instead of always routing to the FrumToronto listing page.
2. **MUX video on business listings** — Elite-tier businesses can upload a promo video. Admin approves it before it goes public.
3. **Non-profit verification** — Businesses can apply for verified non-profit status by uploading a charity document. Admin approves; approved businesses unlock discounted PayPal subscription plans.
4. **Email shoutout in newsletter** — Yearly Elite subscribers get one newsletter shoutout per year. Business writes content → admin approves → shoutout is injected into the next newsletter send on the business's chosen date.
5. **Restaurant dairy/meat filter** — Businesses in restaurant/food categories gain a `diningType` field (dairy, meat, pareve) displayed on their listing and filterable in directory browsing.

---

## 2. Database Schema Changes

All changes go in `src/lib/db/schema.ts`. Run `npm run db:push` after updating.

### 2.1 `businesses` table — new columns

```typescript
// MUX video
muxPlaybackId: varchar("mux_playback_id", { length: 255 }),
muxAssetId: varchar("mux_asset_id", { length: 255 }),
muxUploadId: varchar("mux_upload_id", { length: 255 }),
videoStatus: varchar("video_status", { length: 20 }).default("none"),
// values: none | uploading | processing | ready | errored
videoApprovalStatus: varchar("video_approval_status", { length: 20 }).default("pending"),
// values: pending | approved | rejected
videoRejectionReason: text("video_rejection_reason"),

// Non-profit verification
isNonProfit: boolean("is_non_profit").default(false),
nonProfitDocumentUrl: varchar("non_profit_document_url", { length: 500 }),
nonProfitStatus: varchar("non_profit_status", { length: 20 }).default("none"),
// values: none | pending | verified | rejected
nonProfitRejectionReason: text("non_profit_rejection_reason"),

// Restaurant dining type
diningType: varchar("dining_type", { length: 20 }),
// values: dairy | meat | pareve | unknown (nullable — only set for food businesses)
```

### 2.2 `subscriptionPlans` table — new columns

```typescript
// MUX video feature gate
showVideo: boolean("show_video").default(false),
// Set true only for Elite tier

// Non-profit pricing
priceMonthlyNonProfit: decimal("price_monthly_non_profit", { precision: 10, scale: 2 }),
priceYearlyNonProfit: decimal("price_yearly_non_profit", { precision: 10, scale: 2 }),
paypalPlanIdMonthlyNonProfit: varchar("paypal_plan_id_monthly_non_profit", { length: 100 }),
paypalPlanIdYearlyNonProfit: varchar("paypal_plan_id_yearly_non_profit", { length: 100 }),
paypalPlanIdMonthlyNonProfitSandbox: varchar("paypal_plan_id_monthly_non_profit_sandbox", { length: 100 }),
paypalPlanIdYearlyNonProfitSandbox: varchar("paypal_plan_id_yearly_non_profit_sandbox", { length: 100 }),
```

### 2.3 New table: `businessShoutouts`

```typescript
export const businessShoutouts = pgTable("business_shoutouts", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  scheduledDate: date("scheduled_date").notNull(),
  contentHtml: text("content_html").notNull(),
  contentJson: jsonb("content_json"),       // TipTap JSON for re-editing
  imageUrl: varchar("image_url", { length: 500 }),
  status: varchar("status", { length: 30 }).default("draft").notNull(),
  // values: draft | pending_approval | approved | rejected | sent
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_shoutouts_business").on(table.businessId),
  index("idx_shoutouts_date_status").on(table.scheduledDate, table.status),
]);
```

**Note:** No unique constraint on `(businessId, scheduledDate)` at the DB level — enforce the 365-day cooldown in the API instead (gives better error messages). Do enforce that only one shoutout per business can be in `pending_approval` or `approved` state at a time (check in API before insert).

### 2.4 `businessCategories` table — new column

```typescript
isRestaurant: boolean("is_restaurant").default(false),
// Admin flags which categories are restaurant/food type
// Used to show/hide diningType field in forms and filters
```

### 2.5 `businessSubscriptions` table — new column

```typescript
isNonProfitRate: boolean("is_non_profit_rate").default(false),
// True when this subscription was created using a non-profit discounted plan
```

---

## 3. New Components

### 3.1 `src/components/business/MuxVideoPlayer.tsx`
Client component. Renders `<MuxPlayer>` from `@mux/mux-player-react`.

Props:
```typescript
interface MuxVideoPlayerProps {
  playbackId: string;
  title: string;
}
```

Only renders if `playbackId` is truthy. Wrap in a 16:9 aspect ratio container. No autoplay. Controls visible.

### 3.2 `src/components/business/MuxVideoUploader.tsx`
Client component for business dashboard. Uses `@mux/mux-uploader-react`.

Flow:
1. On mount, check `business.videoStatus` — if already `ready` or `processing`, show current state with a "Remove Video" button instead of the uploader.
2. User clicks "Upload Video" → calls `POST /api/mux/create-upload` → gets back `{ uploadUrl, uploadId }`.
3. Renders `<MuxUploader endpoint={uploadUrl} />`.
4. On `success` event from uploader → calls `POST /api/businesses/[id]/video-uploaded` with `{ uploadId }` to save the uploadId and set `videoStatus = "uploading"`.
5. Shows status message: "Your video has been submitted for review."

States to display:
- `none` → Show uploader
- `uploading` → "Upload in progress..."
- `processing` → "Video is being processed by MUX..."
- `ready` + `videoApprovalStatus = pending` → "Video uploaded. Awaiting admin approval."
- `ready` + `videoApprovalStatus = approved` → "Video is live on your listing." + Remove button
- `ready` + `videoApprovalStatus = rejected` → "Video rejected: [reason]" + Remove button + Re-upload option
- `errored` → "Upload failed. Please try again." + Re-upload option

### 3.3 `src/components/business/NonProfitApplicationForm.tsx`
Client component. Form to apply for non-profit verification.

Fields:
- Organization registration number (text, optional)
- File upload (PDF, JPG, PNG — max 10MB) — uses existing `/api/upload` endpoint with `folder=non-profit-docs`
- Submit button

Only shown when `nonProfitStatus === "none"` or `nonProfitStatus === "rejected"`.

Shows current status badge when `nonProfitStatus === "pending"` or `"verified"`.

### 3.4 `src/components/business/ShoutoutEditor.tsx`
Client component. TipTap editor + date picker for newsletter shoutouts.

Props: `businessId`, `existingShoutout?: BusinessShoutout`

Fields:
- Date picker (calendar) — disables:
  - Past dates
  - Fridays and Saturdays (Shabbat)
  - Dates with existing approved/sent shoutouts for this business
  - Dates that fall within 365 days of a previously sent shoutout
  - Major Chagim (hardcoded list: Rosh Hashana, Yom Kippur, Sukkot, Shemini Atzeret, Simchat Torah, Pesach, Shavuot — use Hebrew calendar via `@hebcal/core`)
- TipTap editor (same setup as blog editor — rich text, no code blocks)
- Optional image upload (single image, 4MB max)
- Submit for approval button

After submit: status changes to `pending_approval` — show confirmation message.

### 3.5 `src/components/admin/BusinessVideoReview.tsx`
Client component. Used inside admin business detail view.

Shows:
- `<MuxPlayer>` preview of the video (if `videoStatus = ready`)
- Approve button → `PATCH /api/admin/businesses/[id]/video` `{ action: "approve" }`
- Reject button → opens textarea for rejection reason → `PATCH` with `{ action: "reject", rejectionReason: "..." }`

### 3.6 `src/components/admin/NonProfitReviewPanel.tsx`
Client component. Shows non-profit document preview and approve/reject controls.

- Image or PDF link to `nonProfitDocumentUrl`
- Status badge
- Approve button → `PATCH /api/admin/businesses/[id]/non-profit` `{ action: "approve" }`
- Reject button → rejection reason textarea → `PATCH` with `{ action: "reject", rejectionReason: "..." }`

### 3.7 `src/components/admin/ShoutoutReviewCard.tsx`
Client component for admin shoutout approval queue.

Displays:
- Business name + link
- Scheduled date
- TipTap-rendered HTML preview
- Optional image preview
- Approve / Reject (with reason) buttons

---

## 4. Modified Components

### 4.1 `src/components/homepage/HomepageBanner.tsx`

Update the `FeaturedBusiness` interface to include `website`:
```typescript
interface FeaturedBusiness {
  id: number;
  name: string;
  slug: string;
  tagline: string | null;
  bannerImageUrl: string | null;
  logoUrl: string | null;
  website: string | null;  // NEW
}
```

Change link logic on the `<Link>` inside the carousel map:
```tsx
// Before
href={`/directory/business/${business.slug}`}

// After
href={business.website || `/directory/business/${business.slug}`}
target={business.website ? "_blank" : undefined}
rel={business.website ? "noopener noreferrer" : undefined}
```

Also update the CTA text:
```tsx
// Before: "Visit Listing →"
// After: business.website ? "Visit Website →" : "View Listing →"
```

### 4.2 `src/components/homepage/HomepageSidebarAds.tsx`

Same link change as above, applied to both `HomepageSidebarAds` and `HomepageSidebarAdsMobile`. The `FeaturedBusiness` interface in this file needs `website` added too.

### 4.3 `src/app/directory/business/[slug]/page.tsx`

**Add `showVideo` to the plan select:**
```typescript
showVideo: subscriptionPlans.showVideo,
```

**Add video fields to the business select:**
```typescript
muxPlaybackId: businesses.muxPlaybackId,
videoStatus: businesses.videoStatus,
videoApprovalStatus: businesses.videoApprovalStatus,
diningType: businesses.diningType,
isNonProfit: businesses.isNonProfit,
nonProfitStatus: businesses.nonProfitStatus,
```

**Add `<MuxVideoPlayer>` section** (after the photo gallery, before the map):
```tsx
{plan?.showVideo && business.videoStatus === "ready" && business.videoApprovalStatus === "approved" && business.muxPlaybackId && (
  <section>
    <h2>Watch Our Video</h2>
    <MuxVideoPlayer playbackId={business.muxPlaybackId} title={business.name} />
  </section>
)}
```

**Add `diningType` badge** — for businesses where the category `isRestaurant = true`, replace the kosher badge section with a dining type badge:
```tsx
{category?.isRestaurant && business.diningType && business.diningType !== "unknown" && (
  <Badge variant="outline">
    {business.diningType === "dairy" ? "Dairy" : business.diningType === "meat" ? "Meat" : "Pareve"}
  </Badge>
)}
```

Show the existing kosher badge alongside the dining type badge (they are not mutually exclusive).

**Add non-profit badge** — near the top of the listing, next to the business name:
```tsx
{business.isNonProfit && business.nonProfitStatus === "verified" && (
  <Badge>Verified Non-Profit</Badge>
)}
```

### 4.4 `src/components/admin/BusinessForm.tsx`

- Add `diningType` dropdown (dairy / meat / pareve / unknown / not applicable). Show only when the selected `categoryId` resolves to a category where `isRestaurant = true`. Fetch category info from `/api/admin/business-categories/[id]` on `categoryId` change.
- Add `tagline` field (already exists — verify it's there).
- Add `bannerImageUrl` field (already exists — verify it's there).
- Add MUX video review panel (`<BusinessVideoReview>`) below the existing fields when `videoStatus` is not `none`.
- Add non-profit review panel (`<NonProfitReviewPanel>`) when `nonProfitDocumentUrl` is not null.

### 4.5 `src/app/(admin)/admin/businesses/page.tsx`

Add a "Non-Profit Verification" tab to the businesses admin tab layout alongside "All Businesses", "Categories", "Plans".

The tab content shows a table of businesses where `nonProfitStatus = "pending"` with quick approve/reject actions.

### 4.6 `src/app/(dashboard)/dashboard/business/[id]/page.tsx` (if it exists, else create it)

Check `src/app/(dashboard)/dashboard/business/[id]/` — it currently only has subdirectories. Add a `page.tsx` for the business detail/management page in the dashboard if it doesn't exist (currently likely redirects to the listing).

Add two new sections to the business dashboard management page:
1. Video upload section using `<MuxVideoUploader>`
2. Non-profit application section using `<NonProfitApplicationForm>`
3. Newsletter shoutout section using `<ShoutoutEditor>` (only shown when subscription is yearly Elite)

### 4.7 `src/app/(admin)/admin/subscription-plans/page.tsx`

Add `showVideo`, non-profit pricing fields, and non-profit PayPal plan ID fields to the plan edit dialog. Non-profit PayPal fields only appear in the UI if `priceMonthlyNonProfit` is set.

### 4.8 `src/lib/validations/content.ts`

Add to `businessSchema`:
```typescript
diningType: z.enum(["dairy", "meat", "pareve", "unknown"]).optional().nullable(),
```

Add to `businessCategorySchema` (or create one):
```typescript
isRestaurant: z.boolean().default(false),
```

### 4.9 `src/app/api/admin/subscription-plans/sync-paypal/route.ts`

Extend the sync to also create non-profit variant plans for each paid tier that has `priceMonthlyNonProfit` set. Store IDs in the new sandbox/live non-profit columns.

---

## 5. New API Routes

### 5.1 `POST /api/mux/create-upload`
Creates a MUX direct upload URL for a business video.

Auth: Must be authenticated. Business must belong to the requesting user. Plan must have `showVideo = true`.

Request body:
```json
{ "businessId": 123 }
```

Logic:
1. Verify session, verify business ownership, verify plan has `showVideo`.
2. Call MUX API: `POST https://api.mux.com/video/v1/uploads` with `new_asset_settings: { playback_policy: ["public"] }`.
3. Save `muxUploadId` to `businesses` table, set `videoStatus = "uploading"`.
4. Return `{ uploadUrl, uploadId }`.

Response:
```json
{ "uploadUrl": "https://storage.googleapis.com/...", "uploadId": "abc123" }
```

### 5.2 `POST /api/businesses/[id]/video-uploaded`
Called by client after MUX uploader completes. Confirms the upload ID is saved.

Auth: Business owner.

Request body:
```json
{ "uploadId": "abc123" }
```

Logic: Verify `uploadId` matches `businesses.muxUploadId`. Set `videoStatus = "uploading"` (MUX webhook will advance it to `processing` then `ready`).

### 5.3 `DELETE /api/businesses/[id]/video`
Business owner removes their video.

Auth: Business owner.

Logic:
1. Fetch `muxAssetId` from business.
2. If set, call MUX API: `DELETE https://api.mux.com/video/v1/assets/[assetId]`.
3. Clear all MUX fields on business: set `muxPlaybackId = null`, `muxAssetId = null`, `muxUploadId = null`, `videoStatus = "none"`, `videoApprovalStatus = "pending"`, `videoRejectionReason = null`.

### 5.4 `POST /api/mux/webhook`
Receives MUX webhooks.

Auth: Verify MUX webhook signature using `MUX_WEBHOOK_SIGNING_SECRET`.

Handled events:
- `video.upload.asset_created` → look up business by `muxUploadId`, set `muxAssetId`, set `videoStatus = "processing"`.
- `video.asset.ready` → look up business by `muxAssetId`, set `muxPlaybackId`, set `videoStatus = "ready"`, set `videoApprovalStatus = "pending"`. Send email to admin notification address.
- `video.asset.errored` → set `videoStatus = "errored"`.
- `video.asset.deleted` → if triggered externally, set `videoStatus = "none"`, clear MUX fields.

### 5.5 `PATCH /api/admin/businesses/[id]/video`
Admin approves or rejects a business video.

Auth: Admin.

Request body:
```json
{ "action": "approve" }
// or
{ "action": "reject", "rejectionReason": "Content is not appropriate." }
```

Logic for `approve`:
- Set `videoApprovalStatus = "approved"`.
- Send email to business owner: "Your video has been approved and is now live on your listing."

Logic for `reject`:
- Set `videoApprovalStatus = "rejected"`, set `videoRejectionReason`.
- Call MUX API to delete the asset: `DELETE https://api.mux.com/video/v1/assets/[assetId]`.
- Clear `muxPlaybackId`, `muxAssetId`, `muxUploadId`, set `videoStatus = "none"`.
- Send email to business owner: "Your video was not approved: [reason]"

### 5.6 `POST /api/businesses/[id]/non-profit-apply`
Business submits non-profit verification application.

Auth: Business owner.

Request body:
```json
{
  "documentUrl": "https://blob.vercel-storage.com/non-profit-docs/...",
  "registrationNumber": "123456789" // optional
}
```

Logic:
- Validate `nonProfitStatus` is `none` or `rejected` (can't re-apply while pending or verified).
- Set `nonProfitDocumentUrl`, `nonProfitStatus = "pending"`.
- Send email to admin notification address.

### 5.7 `PATCH /api/admin/businesses/[id]/non-profit`
Admin approves or rejects non-profit verification.

Auth: Admin.

Request body:
```json
{ "action": "approve" }
// or
{ "action": "reject", "rejectionReason": "Document was not a valid charity registration." }
```

Logic for `approve`:
- Set `nonProfitStatus = "verified"`, `isNonProfit = true`.
- Send email to business owner: "Your non-profit verification has been approved. You may now subscribe at the discounted rate."

Logic for `reject`:
- Set `nonProfitStatus = "rejected"`, `nonProfitRejectionReason`, `isNonProfit = false`.
- Send email to business owner with reason.

### 5.8 `GET /api/admin/businesses/non-profit-applications`
Returns businesses with `nonProfitStatus = "pending"`.

Auth: Admin.

Response:
```json
{
  "data": [
    {
      "id": 1,
      "name": "Bikur Cholim Toronto",
      "slug": "bikur-cholim-toronto",
      "nonProfitDocumentUrl": "https://...",
      "nonProfitStatus": "pending",
      "createdAt": "2026-05-25T00:00:00Z"
    }
  ]
}
```

### 5.9 `GET /api/businesses/[id]/shoutouts`
Returns shoutout history for a business. Business owner only.

Auth: Business owner.

Response: Array of shoutouts with status, scheduled date, content preview.

### 5.10 `POST /api/businesses/[id]/shoutouts`
Business submits a newsletter shoutout.

Auth: Business owner. Plan must be yearly Elite subscription.

Request body:
```json
{
  "scheduledDate": "2026-06-15",
  "contentHtml": "<p>...</p>",
  "contentJson": { ... },
  "imageUrl": "https://..." // optional
}
```

Validation:
- `scheduledDate` must be in the future.
- `scheduledDate` must not be a Friday or Saturday (check `dayOfWeek`).
- `scheduledDate` must not fall on a major Chag (hardcoded list using `@hebcal/core`).
- Business must not have another shoutout with status `pending_approval` or `approved`.
- Business must not have had a shoutout with status `sent` within the last 365 days.

Logic: Insert new shoutout with `status = "pending_approval"`. Send notification email to admin.

### 5.11 `PATCH /api/businesses/[id]/shoutouts/[shoutoutId]`
Business updates a draft or rejected shoutout.

Auth: Business owner. Shoutout must be in `draft` or `rejected` state.

Logic: Update content + date. If was `rejected`, change status back to `pending_approval`.

### 5.12 `GET /api/admin/shoutouts`
Returns shoutouts for admin review.

Auth: Admin.

Query params: `status` (default `pending_approval`), `page`, `limit`.

Response: Paginated list with business name, scheduled date, content preview, status.

### 5.13 `PATCH /api/admin/shoutouts/[id]`
Admin approves or rejects a shoutout.

Auth: Admin.

Request body:
```json
{ "action": "approve" }
// or
{ "action": "reject", "rejectionReason": "..." }
```

Logic for `approve`:
- Set `status = "approved"`.
- Send email to business owner: "Your newsletter shoutout for [date] has been approved."

Logic for `reject`:
- Set `status = "rejected"`, `rejectionReason`.
- Send email to business owner with reason and note they can revise and resubmit.

### 5.14 `GET /api/admin/shoutouts/by-date`
Returns approved shoutouts for a specific newsletter send date.

Auth: Admin.

Query params: `date` (YYYY-MM-DD).

Used by the newsletter composer to show whether a shoutout is booked for a given date.

Response:
```json
{
  "shoutout": {
    "id": 1,
    "businessName": "ABC Catering",
    "contentHtml": "...",
    "imageUrl": "...",
    "status": "approved"
  } | null
}
```

---

## 6. Modified API Routes

### 6.1 `GET /api/featured-businesses/route.ts`

Add `website: businesses.website` to the select statement. The interface returned gains:
```typescript
website: string | null;
```

### 6.2 `PUT /api/admin/businesses/[id]/route.ts`

Add new fields to the update handler:
- `diningType`
- `videoStatus` (admin override)
- `videoApprovalStatus` (admin override — but use the dedicated video endpoint instead where possible)
- `nonProfitStatus` (admin override — but use the dedicated endpoint instead)
- `isNonProfit`

### 6.3 `src/app/api/admin/subscription-plans/[id]/route.ts`

Add new plan fields to the GET and PUT handlers:
- `showVideo`
- `priceMonthlyNonProfit`
- `priceYearlyNonProfit`
- `paypalPlanIdMonthlyNonProfit`
- `paypalPlanIdYearlyNonProfit`
- `paypalPlanIdMonthlyNonProfitSandbox`
- `paypalPlanIdYearlyNonProfitSandbox`

### 6.4 `src/app/api/admin/subscription-plans/route.ts`

Same new fields added to GET (list) and POST (create) handlers.

### 6.5 `src/app/api/admin/business-categories/route.ts` (likely exists)

Add `isRestaurant` to GET and POST/PUT responses. If this route doesn't exist yet, create it with GET + POST + PUT/DELETE for `[id]`.

### 6.6 Newsletter send logic (wherever the newsletter HTML is assembled)

Check `src/app/api/admin/newsletters/[id]/send/route.ts` or the cron job. Before building the email HTML, call `GET /api/admin/shoutouts/by-date?date=[today]`. If a shoutout is returned with `status = "approved"`, inject the shoutout block into the newsletter HTML above the main content. After successful send, mark the shoutout as `status = "sent"`.

---

## 7. User Flows

### 7.1 Ads Link to Website

1. Homepage loads → `HomepageBanner` and `HomepageSidebarAds` fetch from `/api/featured-businesses`.
2. API now includes `website` field.
3. If `business.website` is not null: ad link goes to external URL in new tab.
4. If `business.website` is null: ad link goes to `/directory/business/[slug]` in same tab.
5. CTA text updates accordingly ("Visit Website →" vs "View Listing →").

### 7.2 MUX Video Upload (Business Owner)

1. Business owner logs in → goes to `/dashboard/business/[id]`.
2. If plan has `showVideo = true`, sees "Video" section with current status.
3. If no video: clicks "Upload Video" → `POST /api/mux/create-upload` → gets upload URL.
4. `<MuxUploader>` appears with the upload URL. User selects file (MP4/MOV, suggested max 500MB — MUX handles this on their side).
5. After upload completes: client calls `POST /api/businesses/[id]/video-uploaded`. UI shows "Video uploaded — awaiting admin approval."
6. MUX webhooks fire: `video.upload.asset_created` → `video.asset.ready`. Business `videoStatus` updates to `ready`, `videoApprovalStatus` stays `pending`. Admin receives email.
7. Admin logs in → goes to `/admin/businesses`, clicks on the business → sees `<BusinessVideoReview>` panel with embedded player.
8. Admin clicks "Approve" → `videoApprovalStatus = "approved"`. Business owner receives approval email. Video appears on public listing page.

### 7.3 Non-Profit Verification

1. Business owner on `/dashboard/business/[id]` → clicks "Apply for Non-Profit Status".
2. Fills `<NonProfitApplicationForm>`: uploads charity document via `/api/upload?folder=non-profit-docs`. Submits → `POST /api/businesses/[id]/non-profit-apply`.
3. `nonProfitStatus` set to `pending`. Admin receives email notification.
4. Admin logs in → `/admin/businesses` → "Non-Profit Verification" tab → sees pending application.
5. Admin reviews document (link to PDF/image). Clicks "Approve" → `PATCH /api/admin/businesses/[id]/non-profit` with `{ action: "approve" }`.
6. `isNonProfit = true`, `nonProfitStatus = "verified"`. Business owner receives approval email with next steps (they will see discounted pricing on the subscription/upgrade page).
7. When business owner upgrades or renews, the subscription creation flow checks `isNonProfit = true` and uses `paypalPlanIdMonthlyNonProfit` (or yearly variant) instead of the standard PayPal plan ID.

### 7.4 Newsletter Shoutout

1. Business owner on yearly Elite plan → `/dashboard/business/[id]` → "Newsletter Shoutout" section.
2. Sees their shoutout history. If no shoutout in the past 365 days and no pending/approved shoutout, a "Schedule Shoutout" button is shown.
3. Clicks button → `<ShoutoutEditor>` opens. Picks date (calendar disables invalid dates). Writes content in TipTap. Optionally uploads image. Clicks "Submit for Approval."
4. `POST /api/businesses/[id]/shoutouts` → validates date, checks 365-day cooldown, inserts shoutout with `status = "pending_approval"`. Admin receives email.
5. Admin logs in → `/admin/programs` → new "Shoutouts" tab → sees pending shoutouts sorted by scheduled date.
6. Admin previews content. Clicks "Approve" → `PATCH /api/admin/shoutouts/[id]` → `status = "approved"`. Business owner receives confirmation email.
7. On the day of the shoutout, when admin triggers newsletter send, the send logic checks `/api/admin/shoutouts/by-date?date=[today]`. Finds approved shoutout. Injects it as a styled block at the top of the newsletter HTML (before main content). After send completes, marks shoutout as `sent`.
8. If admin rejects: business owner receives email with reason and can revise via `PATCH /api/businesses/[id]/shoutouts/[shoutoutId]` and resubmit.

### 7.5 Restaurant Dairy/Meat Filter

1. Admin goes to `/admin/businesses/categories` → edits a category (e.g., "Restaurants") → checks "Restaurant category" checkbox → saves (sets `isRestaurant = true`).
2. Admin or business owner fills out business form for a business in a restaurant category → `diningType` dropdown appears (Dairy / Meat / Pareve / Unknown).
3. On the public business listing `/directory/business/[slug]`: if category `isRestaurant = true`, a badge shows (e.g., "Dairy", "Meat", "Pareve").
4. On the directory listing page (category browse): when viewing a restaurant category, a filter bar shows: "All | Dairy | Meat | Pareve". Filter applies client-side (or via query param `diningType=dairy`).

---

## 8. MUX Integration Architecture

### 8.1 Package Setup

```bash
npm install @mux/mux-node @mux/mux-player-react @mux/mux-uploader-react
```

### 8.2 MUX Client

Create `src/lib/mux/client.ts`:

```typescript
import Mux from "@mux/mux-node";

const mux = process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET
  ? new Mux({
      tokenId: process.env.MUX_TOKEN_ID,
      tokenSecret: process.env.MUX_TOKEN_SECRET,
    })
  : null;

export function getMuxClient(): Mux {
  if (!mux) throw new Error("MUX not configured");
  return mux;
}
```

### 8.3 Upload Flow Detail

```
Client                API                  MUX
  |                    |                    |
  |-- POST /api/mux/create-upload -------->|
  |                    |-- POST /video/v1/uploads
  |                    |<-- { id, url }     |
  |<-- { uploadUrl, uploadId }             |
  |                    |                    |
  |-- MuxUploader (PUT file to uploadUrl) ->|
  |                    |                    |
  |-- POST /api/businesses/[id]/video-uploaded
  |                    |                    |
  |                   [MUX processes video] |
  |                    |                    |
  |                    |<-- webhook: upload.asset_created
  |                    |   (save assetId, videoStatus=processing)
  |                    |                    |
  |                    |<-- webhook: asset.ready
  |                    |   (save playbackId, videoStatus=ready)
  |                    |   (videoApprovalStatus=pending)
  |                    |   (notify admin)   |
```

### 8.4 Webhook Security

In `POST /api/mux/webhook/route.ts`:

```typescript
import { verifyWebhookSignature } from "@mux/mux-node";

const webhookSecret = process.env.MUX_WEBHOOK_SIGNING_SECRET;
if (!webhookSecret) throw new Error("MUX_WEBHOOK_SIGNING_SECRET not set");

const body = await request.text();
const signature = request.headers.get("mux-signature") || "";

try {
  verifyWebhookSignature(body, signature, webhookSecret);
} catch {
  return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
}
```

### 8.5 Environment Variables (new)

```bash
MUX_TOKEN_ID=...
MUX_TOKEN_SECRET=...
MUX_WEBHOOK_SIGNING_SECRET=...
```

Register the webhook in MUX dashboard pointing to `https://frumtoronto.com/api/mux/webhook`. Events to subscribe: `video.upload.asset_created`, `video.asset.ready`, `video.asset.errored`, `video.asset.deleted`.

---

## 9. PayPal Non-Profit Plan Sync

### 9.1 How It Works

Non-profit plans are separate PayPal billing plans linked to the same PayPal product as standard plans. They have lower pricing but otherwise identical billing mechanics.

### 9.2 Sync Logic Extension

In `src/app/api/admin/subscription-plans/sync-paypal/route.ts`, after creating standard monthly/yearly plans, iterate paid tiers again:

```typescript
for (const plan of paidPlans) {
  if (!plan.priceMonthlyNonProfit) continue; // Skip if no NP pricing set

  // Create non-profit monthly plan
  const npMonthly = await createPayPalPlan(
    productId,
    `${plan.name} - Non-Profit (Monthly)`,
    `${plan.name} plan at non-profit rate`,
    plan.priceMonthlyNonProfit,
    "MONTH"
  );
  // Save npMonthly.id to paypalPlanIdMonthlyNonProfit (or sandbox variant)

  // Create non-profit yearly plan if applicable
  if (plan.priceYearlyNonProfit) {
    const npYearly = await createPayPalPlan(...);
    // Save to paypalPlanIdYearlyNonProfit
  }
}
```

### 9.3 Subscription Creation: Non-Profit Rate Selection

In `src/app/api/paypal/create-subscription/route.ts`, add logic:

```typescript
// Existing: pick planId based on billingCycle + mode
// New: if business.isNonProfit === true, use non-profit plan ID instead

const useNonProfit = business.isNonProfit;
const planId = isSandbox
  ? (useNonProfit ? plan.paypalPlanIdMonthlyNonProfitSandbox : plan.paypalPlanIdMonthlySandbox)
  : (useNonProfit ? plan.paypalPlanIdMonthlyNonProfit : plan.paypalPlanIdMonthly);

// Also set businessSubscriptions.isNonProfitRate = useNonProfit when inserting
```

---

## 10. Edge Cases & Validation

### Ads Link

- If `business.website` exists but doesn't start with `http://` or `https://`, prepend `https://` before using as href.
- Track ad clicks: consider adding a `POST /api/ad-click` endpoint later for analytics (out of scope for this spec).

### MUX Video

- Only one video per business at a time. If business uploads a new video while an existing approved video exists, delete the old MUX asset first.
- File size: MUX accepts up to 16GB, but the direct upload URL can be configured with a max. Set max to 500MB on the MUX upload creation call: `cors_origin: process.env.NEXT_PUBLIC_APP_URL, max_resolution_tier: "1080p"`.
- If the business downgrades from Elite plan: video remains visible until subscription ends (don't auto-delete on plan change). Admin can manually remove if needed.
- `videoApprovalStatus` resets to `"pending"` whenever a new video is uploaded (even if replacing an approved one).

### Non-Profit Verification

- Once `nonProfitStatus = "verified"`, the admin cannot change it back to `none` through the normal UI. Only through direct DB or a dedicated "Revoke" action (scope this separately).
- Non-profit pricing does not auto-apply to existing subscriptions. The business must cancel and resubscribe, or wait for renewal cycle and contact admin.
- Accepted document formats via `/api/upload`: PDF, JPG, PNG. Max 10MB. Use existing upload route with `folder=non-profit-docs`.
- If business deletes the account, documents in Vercel Blob are not auto-deleted (blob cleanup is a separate concern).

### Newsletter Shoutout

- 365-day cooldown: calculated from the `scheduledDate` of the most recent `sent` shoutout, not from the `createdAt` date.
- Only one active shoutout per business at a time (cannot have both `pending_approval` and `approved`).
- If the newsletter send on the scheduled date is skipped or never sent, the shoutout stays `approved`. Admin must manually mark it `sent` or reschedule via the admin shoutout panel (add a "Reschedule" action to `PATCH /api/admin/shoutouts/[id]`).
- Shabbat check: check `date.getDay() === 5` (Friday) or `date.getDay() === 6` (Saturday). Note that Shabbat starts Friday at sunset, but for simplicity block the entire Friday and Saturday.
- Chagim list (hardcoded approximate Gregorian date ranges for 2026-2027 — or use `@hebcal/core` to check Jewish calendar):
  - Check if the Hebrew date is: 1-2 Tishrei, 10 Tishrei, 15-22 Tishrei, 15-22 Nissan, 6-7 Sivan.
  - Use `HebrewCalendar.getHolidaysOnDate()` from `@hebcal/core` to check.

### Restaurant Dining Type

- `diningType` field is nullable. Only set a value when `category.isRestaurant = true`. If a business changes category from restaurant to non-restaurant, `diningType` should be cleared (set to null) in the API.
- The filter on the directory page should only appear when the current category being browsed has `isRestaurant = true`. Don't show the filter globally.
- `diningType = "unknown"` means kosher but the dairy/meat status is not specified — show nothing in that case (treat same as null for display purposes).

---

## 11. Migration Notes

### SQL migrations to run (in order)

These can be run as a single migration script at `scripts/apply-monetization-schema.ts` using the Neon serverless driver directly.

```sql
-- 1. businesses table additions
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS mux_playback_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS mux_asset_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS mux_upload_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS video_status VARCHAR(20) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS video_approval_status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS video_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_non_profit BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS non_profit_document_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS non_profit_status VARCHAR(20) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS non_profit_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS dining_type VARCHAR(20);

-- 2. subscription_plans table additions
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS show_video BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_monthly_non_profit DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS price_yearly_non_profit DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS paypal_plan_id_monthly_non_profit VARCHAR(100),
  ADD COLUMN IF NOT EXISTS paypal_plan_id_yearly_non_profit VARCHAR(100),
  ADD COLUMN IF NOT EXISTS paypal_plan_id_monthly_non_profit_sandbox VARCHAR(100),
  ADD COLUMN IF NOT EXISTS paypal_plan_id_yearly_non_profit_sandbox VARCHAR(100);

-- 3. business_categories table addition
ALTER TABLE business_categories
  ADD COLUMN IF NOT EXISTS is_restaurant BOOLEAN DEFAULT false;

-- 4. business_subscriptions table addition
ALTER TABLE business_subscriptions
  ADD COLUMN IF NOT EXISTS is_non_profit_rate BOOLEAN DEFAULT false;

-- 5. New business_shoutouts table
CREATE TABLE IF NOT EXISTS business_shoutouts (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  content_html TEXT NOT NULL,
  content_json JSONB,
  image_url VARCHAR(500),
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shoutouts_business ON business_shoutouts(business_id);
CREATE INDEX IF NOT EXISTS idx_shoutouts_date_status ON business_shoutouts(scheduled_date, status);

-- 6. Set show_video = true for Elite plan (run after confirming Elite plan ID)
-- UPDATE subscription_plans SET show_video = true WHERE slug = 'elite';

-- 7. Mark restaurant-type categories (run after confirming category IDs)
-- UPDATE business_categories SET is_restaurant = true WHERE name ILIKE '%restaurant%' OR name ILIKE '%food%';
```

### Drizzle schema sync

After applying SQL, update `src/lib/db/schema.ts` to match and run `npm run db:generate` to generate migration files for the record.

### Post-migration admin tasks

1. Set `show_video = true` on the Elite plan via admin UI or SQL.
2. Mark restaurant-type categories with `isRestaurant = true` in admin.
3. Set non-profit pricing on relevant plans via admin subscription plans UI.
4. Click "Sync to PayPal" to create non-profit billing plans on PayPal (sandbox first, then live).
5. Register MUX webhook URL in MUX dashboard.
6. Add MUX environment variables to Vercel.

---

## File Path Reference

| Purpose | File |
|---------|------|
| DB schema | `src/lib/db/schema.ts` |
| MUX client | `src/lib/mux/client.ts` (new) |
| MUX create upload | `src/app/api/mux/create-upload/route.ts` (new) |
| MUX webhook | `src/app/api/mux/webhook/route.ts` (new) |
| Video uploaded confirm | `src/app/api/businesses/[id]/video-uploaded/route.ts` (new) |
| Delete video | `src/app/api/businesses/[id]/video/route.ts` (new — DELETE) |
| Admin video approve/reject | `src/app/api/admin/businesses/[id]/video/route.ts` (new — PATCH) |
| Non-profit apply | `src/app/api/businesses/[id]/non-profit-apply/route.ts` (new) |
| Admin non-profit approve/reject | `src/app/api/admin/businesses/[id]/non-profit/route.ts` (new — PATCH) |
| Admin non-profit list | `src/app/api/admin/businesses/non-profit-applications/route.ts` (new) |
| Shoutouts (owner) | `src/app/api/businesses/[id]/shoutouts/route.ts` (new — GET, POST) |
| Shoutout update | `src/app/api/businesses/[id]/shoutouts/[shoutoutId]/route.ts` (new — PATCH) |
| Admin shoutouts | `src/app/api/admin/shoutouts/route.ts` (new — GET) |
| Admin shoutout action | `src/app/api/admin/shoutouts/[id]/route.ts` (new — PATCH) |
| Admin shoutout by date | `src/app/api/admin/shoutouts/by-date/route.ts` (new — GET) |
| Featured businesses API | `src/app/api/featured-businesses/route.ts` (modify) |
| Homepage banner | `src/components/homepage/HomepageBanner.tsx` (modify) |
| Homepage sidebar ads | `src/components/homepage/HomepageSidebarAds.tsx` (modify) |
| Business listing page | `src/app/directory/business/[slug]/page.tsx` (modify) |
| Admin business form | `src/components/admin/BusinessForm.tsx` (modify) |
| Admin businesses page | `src/app/(admin)/admin/businesses/page.tsx` (modify) |
| Admin subscription plans | `src/app/(admin)/admin/subscription-plans/page.tsx` (modify) |
| PayPal sync | `src/app/api/admin/subscription-plans/sync-paypal/route.ts` (modify) |
| PayPal create sub | `src/app/api/paypal/create-subscription/route.ts` (modify) |
| MUX video player | `src/components/business/MuxVideoPlayer.tsx` (new) |
| MUX video uploader | `src/components/business/MuxVideoUploader.tsx` (new) |
| Non-profit application form | `src/components/business/NonProfitApplicationForm.tsx` (new) |
| Shoutout editor | `src/components/business/ShoutoutEditor.tsx` (new) |
| Admin video review | `src/components/admin/BusinessVideoReview.tsx` (new) |
| Admin non-profit review | `src/components/admin/NonProfitReviewPanel.tsx` (new) |
| Admin shoutout review card | `src/components/admin/ShoutoutReviewCard.tsx` (new) |
| Migration script | `scripts/apply-monetization-schema.ts` (new) |
| Validation schemas | `src/lib/validations/content.ts` (modify) |
