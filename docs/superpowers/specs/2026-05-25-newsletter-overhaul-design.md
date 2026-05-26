# Newsletter Overhaul — Design Spec

**Date:** 2026-05-25
**Status:** Draft

---

## 1. Overview

The newsletter compose page gets a full overhaul: a two-panel layout where the admin writes the main newsletter body in TipTap on the left, and a collapsible sidebar on the right exposes toggleable auto-content blocks. When toggled on, a block pulls live data from the database and renders a preview inline. At send time, admin clicks "Preview" to freeze the current data into a final rendered HTML email — what they see in the preview is exactly what gets sent.

This replaces the current minimal compose page (`src/app/(admin)/admin/newsletters/[id]/page.tsx`) with a redesigned experience that requires no manual copy-pasting of community data.

### Goals

- Let the admin author a rich newsletter in 5 minutes by toggling community data in rather than writing it by hand
- Freeze data at preview time so sends are deterministic (no race conditions from live queries)
- Store a full snapshot of every block's data for audit purposes
- Keep the email template consistent and on-brand regardless of which blocks are toggled

---

## 2. Database Schema Changes

### 2a. New table: `newsletterBlockSnapshots`

Stores the exact data that was rendered for each block when a newsletter was sent. One row per block per send.

```typescript
// src/lib/db/schema.ts — add to newsletter section

export const newsletterBlockSnapshots = pgTable("newsletter_block_snapshots", {
  id: serial("id").primaryKey(),
  newsletterSendId: integer("newsletter_send_id")
    .notNull()
    .references(() => newsletterSends.id, { onDelete: "cascade" }),
  blockType: varchar("block_type", { length: 50 }).notNull(),
  // e.g. "atr", "simchas", "events", "blog", "tehillim", "shoutout", "omer"
  snapshotData: jsonb("snapshot_data").notNull(),
  // The exact records rendered — shape depends on blockType
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### 2b. New table: `newsletterBlockSettings`

Persists per-newsletter block toggle state and configuration so the admin can close and reopen the compose page without losing their selections.

```typescript
export const newsletterBlockSettings = pgTable("newsletter_block_settings", {
  id: serial("id").primaryKey(),
  newsletterId: integer("newsletter_id")
    .notNull()
    .references(() => newsletters.id, { onDelete: "cascade" }),
  blockType: varchar("block_type", { length: 50 }).notNull(),
  isEnabled: boolean("is_enabled").default(false).notNull(),
  config: jsonb("config"),
  // Block-specific config — e.g. for simchas: { simchaTypes: ["birth", "engagement"] }
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**Unique constraint:** `(newsletterId, blockType)` — one settings row per block per newsletter.

### 2c. Existing tables — no changes required

- `newsletters` — unchanged; `contentJson` stores TipTap JSON, `content` stores rendered HTML
- `newsletterSends` — unchanged; `status` enum already has what we need
- `emailSubscribers` — unchanged
- `businessShoutouts` — will be created by the business monetization spec; this spec references it but does not define it

---

## 3. Redesigned Newsletter Compose UI

### File

`src/app/(admin)/admin/newsletters/[id]/page.tsx`

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  Admin Header                                           │
├──────────────────────────────┬──────────────────────────┤
│                              │                          │
│   TipTap Editor              │   Auto-Content Sidebar   │
│   (main body)                │   (collapsible)          │
│                              │                          │
│   Full height, scrollable    │   Toggle chevron ›       │
│                              │   at top-right           │
│                              │                          │
│                              │   Block toggles:         │
│                              │   [─] Sefirat HaOmer     │
│                              │   [✓] Business Shoutout  │
│                              │   [✓] ATR Questions      │
│                              │   [─] Upcoming Events    │
│                              │   [✓] Recent Simchas     │
│                              │       ↳ Types dropdown   │
│                              │   [─] Latest Blog Posts  │
│                              │   [─] Tehillim List      │
│                              │                          │
│                              │   ── Preview ──          │
│                              │   (inline block previews │
│                              │    for enabled blocks)   │
│                              │                          │
├──────────────────────────────┴──────────────────────────┤
│  Bottom bar: [Save Draft]  [Preview Email]  [Send →]    │
└─────────────────────────────────────────────────────────┘
```

### Responsive behavior

- **Desktop (lg+):** Editor left (flex-grow), sidebar right (w-80, fixed height, scroll independently)
- **Tablet (md):** Sidebar collapses by default, toggled via chevron button pinned to the right edge
- **Mobile:** Sidebar hidden; blocks accessible via a "Content Blocks" sheet (bottom drawer)

### Sidebar block card anatomy

Each block in the sidebar is a card:

```
┌─────────────────────────────┐
│ [toggle switch]  Block Name │  ← header row
│                             │
│  Status badge / preview     │  ← shown when toggled on
│  (small, condensed)         │
│                             │
│  [config controls if any]   │  ← e.g. simcha type picker
└─────────────────────────────┘
```

- Toggle off: card is dimmed, preview area hidden
- Toggle on + no data: card shows amber warning badge "No data — block will be hidden in email"
- Toggle on + data available: card shows green badge + compact data preview (first 2-3 items listed)
- Sefirat HaOmer during Omer period: card shows today's count in the preview
- Sefirat HaOmer outside Omer period: card is hidden from sidebar entirely

### Bottom action bar

Fixed to bottom of page. Three actions:

| Button | Behavior |
|--------|----------|
| Save Draft | PATCH `/api/admin/newsletters/[id]` — saves TipTap content + block settings |
| Preview Email | Opens preview modal (see Section 5) |
| Send → | Opens send dialog (audience picker + confirm) |

---

## 4. Auto-Content Block Specifications

Blocks are listed in sidebar display order. The email injection order is defined separately in Section 6.

### Block 1: Sefirat HaOmer

**Sidebar visibility:** Only shown during the 49-day Omer period (between Pesach day 2 and Shavuot). Calculated using `@hebcal/core` — same library already used in `src/lib/zmanim.ts`.

**Config:** None — fully automatic.

**Data source:** Calculated at preview time using `@hebcal/core`'s `Omer` class. No database query.

**Preview in sidebar:** Shows "Day X of the Omer" with the Hebrew name of the day (e.g., "Day 33 — Lag BaOmer").

**In email:** A styled banner block with the day count, Hebrew name, and the full Hebrew/English formula (e.g., "Hayom shloshim v'shlosha yom...").

**Empty/unavailable state:** Block is entirely hidden from sidebar when not Omer period.

---

### Block 2: Business Shoutout

**Config:** None — fully automatic. The block pulls any `businessShoutouts` row where `scheduledDate = send_date` and `status = 'approved'`.

**Note:** `send_date` is the date the admin clicks "Preview Email" — the date the preview is frozen, which becomes the send date.

**Data source:** `businessShoutouts` table (created by business monetization spec). Query:

```sql
SELECT bs.*, b.name, b.slug, b.bannerImageUrl, b.tagline
FROM business_shoutouts bs
JOIN businesses b ON bs.businessId = b.id
WHERE bs.scheduledDate = :sendDate
  AND bs.status = 'approved'
LIMIT 1
```

**Preview in sidebar:**
- Data found: green badge "Booked — [Business Name]"
- No data: amber badge "No business booked for this date"

**Greyed-out state:** When no shoutout is booked, the toggle remains operable but the sidebar card shows the amber warning. If admin enables it anyway, the block is silently omitted from the final email (no empty section rendered).

**In email:** Business logo/banner image, name, tagline, brief description, CTA button linking to `/directory/business/[slug]`.

---

### Block 3: ATR Questions

**Config:** None — pulls last 7 days automatically.

**Data source:**

```sql
SELECT id, questionNumber, title, question, answer, publishedAt
FROM ask_the_rabbi
WHERE isPublished = true
  AND publishedAt >= NOW() - INTERVAL '7 days'
ORDER BY publishedAt DESC
```

**Preview in sidebar:** List of question titles (truncated at 60 chars). Count badge: "3 questions this week".

**Empty state:** Block card shows grey badge "No questions published this week — block will be hidden in email". If toggled on with no data, the block is omitted from the final email.

**In email:** Section header "Ask the Rabbi", then each Q&A rendered as: question title in bold, brief excerpt of the answer (first 200 chars + "Read more" link to `/ask-the-rabbi#q[questionNumber]`).

---

### Block 4: Upcoming Events

**Config:** None — pulls next 7 days automatically.

**Data source:**

```sql
SELECT id, title, startTime, endTime, eventType, location, description
FROM events
WHERE approvalStatus = 'approved'
  AND isActive = true
  AND startTime >= NOW()
  AND startTime <= NOW() + INTERVAL '7 days'
ORDER BY startTime ASC
```

**Preview in sidebar:** List of event titles with date (e.g., "Tue May 27 — Shiur at Shaarei Shomayim"). Count badge: "4 events this week".

**Empty state:** Grey badge "No events this week — block will be hidden in email".

**In email:** Section header "Upcoming Events in Toronto", then each event as a card: title, date/time, location, brief description excerpt, link to `/community/calendar/[id]`.

---

### Block 5: Recent Simchas

**Config:** Multi-select dropdown for simcha types. Options: Births, Engagements, Weddings. Default: all three selected. Admin selection is saved to `newsletterBlockSettings.config` as `{ simchaTypes: ["birth", "engagement", "wedding"] }`.

**Data source:** Joins `simchas` with `simchaTypes`:

```sql
SELECT s.id, s.name, s.description, s.eventDate, s.createdAt, st.name as typeName, st.slug as typeSlug
FROM simchas s
JOIN simcha_types st ON s.simchaTypeId = st.id
WHERE s.approvalStatus = 'approved'
  AND s.createdAt >= NOW() - INTERVAL '7 days'
  AND st.slug IN (:selectedTypes)
ORDER BY s.createdAt DESC
```

**Preview in sidebar:** List of names + simcha type (e.g., "Mazel Tov — Goldberg Family (Birth)"). Count badge.

**Empty state:** Grey badge "No [selected type] simchas this week — block will be hidden in email".

**In email:** Section header "Mazel Tov!", grouped by simcha type (Births, then Engagements, then Weddings). Each entry: name, optional brief description. No photos — text only for email client compatibility.

---

### Block 6: Latest Blog Posts

**Config:** None — auto-pulls last 3 published posts.

**Data source:**

```sql
SELECT id, title, slug, excerpt, coverImageUrl, publishedAt
FROM blog_posts
WHERE approvalStatus = 'approved'
  AND isActive = true
  AND publishedAt IS NOT NULL
ORDER BY publishedAt DESC
LIMIT 3
```

**Preview in sidebar:** List of post titles. Count badge: "3 posts".

**Empty state:** Grey badge "No published posts — block will be hidden in email".

**In email:** Section header "From the Blog", then up to 3 post cards: cover image (if any), title, excerpt (first 150 chars), "Read more" link to `/blog/[slug]`.

---

### Block 7: Tehillim List

**Config:** None — pulls all active requests.

**Data source:**

```sql
SELECT id, name, hebrewName, motherName, notes, createdAt
FROM tehillim_list
WHERE isActive = true
ORDER BY createdAt ASC
```

**Preview in sidebar:** Count badge: "8 names on list". First 3 names shown.

**Empty state:** Grey badge "Tehillim list is empty — block will be hidden in email".

**In email:** Section header "Tehillim — Please Daven For", then a clean comma-separated list of names (Hebrew name / mother's name format where available). No full table layout — plain prose for email client compatibility.

---

## 5. Preview & Test Send Architecture

### Flow

```
Admin clicks "Preview Email"
         │
         ▼
POST /api/admin/newsletters/[id]/preview
  ├── Reads TipTap content from DB
  ├── For each enabled block: fetches live data NOW
  ├── Renders all blocks into final HTML (using renderNewsletterHTML())
  ├── Returns { html, previewId, blocksRendered: [...] }
         │
         ▼
PreviewModal opens
  ├── Shows rendered HTML in <iframe> (sandboxed)
  ├── Shows list of blocks included
  ├── "Send Test Email" button → POST /api/admin/newsletters/[id]/test-send
  │     └── body: { previewId, to: "admin@example.com" }
  │     └── Uses already-rendered HTML from previewId (no re-fetch)
  └── "Send to All" button → POST /api/admin/newsletters/[id]/send
        └── body: { previewId, audience: "newsletter" }
        └── Uses already-rendered HTML from previewId (no re-fetch)
```

### Preview caching

The preview endpoint generates a `previewId` (UUID) and stores the rendered HTML temporarily in a new `newsletterPreviews` in-memory cache (or in the `newsletters` table as a `previewHtml` column + `previewGeneratedAt` timestamp). Since Vercel is serverless, storing in the database is more reliable.

**Preferred approach:** Add `previewHtml` (text) and `previewGeneratedAt` (timestamp) columns to the `newsletters` table. The preview is valid for 30 minutes. After 30 minutes, clicking "Send to All" requires re-generating the preview first.

**Database addition:**

```typescript
// Add to newsletters table in schema.ts
previewHtml: text("preview_html"),
previewGeneratedAt: timestamp("preview_generated_at"),
```

### Test send

- Sends the exact `previewHtml` to any email address the admin types in
- No subscriber filtering — just a direct Resend send to the provided address
- Does not count toward `newsletterSends` stats
- Does not create a `newsletterSends` row

### Send to All

1. Validates `previewGeneratedAt` is within 30 minutes
2. Creates `newsletterSends` row with `status = "sending"`
3. Fetches all subscribers where `newsletter = true`
4. Creates `newsletterRecipientLogs` rows
5. Sends in batches of 100 via Resend batch API (same as current system)
6. Creates `newsletterBlockSnapshots` rows for each enabled block (snapshot of the data rendered)
7. Updates `newsletterSends.status = "sent"` when complete

---

## 6. Email Rendering Logic

### Injection order in final email

```
1. Email header (logo, site name)
2. [if enabled] Sefirat HaOmer block
3. [if enabled + data] Business Shoutout block
4. TipTap main content (always present)
5. [if enabled + data] ATR Questions block
6. [if enabled + data] Upcoming Events block
7. [if enabled + data] Recent Simchas block
8. [if enabled + data] Latest Blog Posts block
9. [if enabled + data] Tehillim List block
10. Email footer (unsubscribe links, preferences link, copyright)
```

### Renderer function

**File:** `src/lib/email/newsletter-renderer.ts` (new file)

```typescript
export interface NewsletterRenderInput {
  newsletter: { title: string; subject: string; content: string }; // content = TipTap HTML
  blocks: {
    omer?: OmerData | null;
    shoutout?: BusinessShoutoutData | null;
    atr?: AtrQuestion[] | null;
    events?: EventData[] | null;
    simchas?: SimchaData[] | null;
    blog?: BlogPostData[] | null;
    tehillim?: TehillimEntry[] | null;
  };
  recipientEmail: string;
  unsubscribeToken: string;
}

export function renderNewsletterHTML(input: NewsletterRenderInput): string {
  // Builds full email HTML string
  // Uses table-based layout throughout (email client compatibility)
  // Inlines all CSS — no external stylesheets
  // Returns complete HTML document
}
```

Each block has its own render function:

```typescript
function renderOmerBlock(data: OmerData): string { ... }
function renderShoutoutBlock(data: BusinessShoutoutData): string { ... }
function renderAtrBlock(questions: AtrQuestion[]): string { ... }
function renderEventsBlock(events: EventData[]): string { ... }
function renderSimchasBlock(simchas: SimchaData[]): string { ... }
function renderBlogBlock(posts: BlogPostData[]): string { ... }
function renderTehillimBlock(entries: TehillimEntry[]): string { ... }
```

### Block separator

Between each block in the email, a thin horizontal rule: `<tr><td style="padding: 24px 0;"><hr style="border: none; border-top: 1px solid #e5e7eb;" /></td></tr>`

### TipTap HTML passthrough

The `newsletter.content` field (HTML string from TipTap) is injected directly into the email body between the shoutout block and the ATR block. No additional processing — assume TipTap HTML is safe (admin-authored). Wrap it in a standard table cell with appropriate padding.

---

## 7. New Components

### `NewsletterComposePage` (refactored)

**File:** `src/app/(admin)/admin/newsletters/[id]/page.tsx`

Convert from a server component with a simple form to a client-heavy page. The page shell remains a server component for auth + initial data fetch; it passes data down to:

### `NewsletterComposeClient`

**File:** `src/components/newsletter/NewsletterComposeClient.tsx`

Top-level client component for the compose page. Manages:
- TipTap editor state
- Sidebar open/closed state
- Block toggle states (loaded from `newsletterBlockSettings` on mount)
- Auto-save debounce (saves block settings + TipTap content every 30s or on blur)
- Preview modal open/closed state

### `NewsletterBlockSidebar`

**File:** `src/components/newsletter/NewsletterBlockSidebar.tsx`

Right-side panel. Props:
- `blocks: BlockState[]` — array of block configs with enabled/data state
- `onToggle(blockType: string, enabled: boolean): void`
- `onConfigChange(blockType: string, config: object): void`
- `isCollapsed: boolean`
- `onCollapseToggle(): void`

Renders each block as a `NewsletterBlockCard`.

### `NewsletterBlockCard`

**File:** `src/components/newsletter/NewsletterBlockCard.tsx`

Single block toggle card. Props:
- `blockType: string`
- `label: string`
- `isEnabled: boolean`
- `data: unknown | null` — live preview data fetched from API
- `isEmpty: boolean`
- `config?: object`
- `onToggle(enabled: boolean): void`
- `onConfigChange?(config: object): void`
- `children?: React.ReactNode` — config controls slot

### `SimchaTypesPicker`

**File:** `src/components/newsletter/SimchaTypesPicker.tsx`

Multi-select dropdown for simcha types. Used inside the simchas `NewsletterBlockCard`. Props:
- `selected: string[]` — array of simcha type slugs
- `onChange(selected: string[]): void`

Uses a Popover + checkboxes pattern (shadcn/ui Popover + Checkbox).

### `NewsletterPreviewModal`

**File:** `src/components/newsletter/NewsletterPreviewModal.tsx`

Full-screen modal (Dialog from shadcn/ui) showing the rendered preview. Contains:
- `<iframe>` (sandboxed, `srcdoc` attribute) rendering the full email HTML
- Sidebar panel listing which blocks are included
- "Send Test Email" form (email input + button)
- "Send to All" button with audience confirmation
- Preview expiry countdown ("Preview expires in 28 minutes — regenerate to resend")

### `NewsletterSendDialog`

**File:** `src/components/newsletter/NewsletterSendDialog.tsx`

Confirmation dialog triggered from "Send to All" inside the preview modal. Shows:
- Recipient count estimate (fetched from `/api/admin/newsletters/[id]/recipient-count`)
- Which blocks are included
- Confirm / Cancel buttons

---

## 8. Modified Components

### `NewsletterForm.tsx`

**File:** `src/components/admin/NewsletterForm.tsx`

Currently contains: subject, preview text fields + TipTap editor + segment dropdown + send dialog.

**Changes:**
- Extract TipTap editor into its own usage inside `NewsletterComposeClient` (the form wrapper is no longer needed as a standalone component for the compose page)
- Keep `NewsletterForm.tsx` for the newsletter list page's "New Newsletter" dialog (title + subject only, no editor — editor opens after creation)
- Remove segment dropdown entirely (segments feature deprecated in favor of direct audience targeting per the 2026-03-18 newsletter enhancements spec)

### `src/lib/email/newsletter-template.ts`

No structural changes. The `renderNewsletterHTML()` function in the new `newsletter-renderer.ts` will import and extend the base styles from this file rather than duplicating them.

### `src/app/api/admin/newsletters/[id]/send/route.ts`

**Current behavior:** Accepts `{ segmentId, scheduledAt }`, kicks off a send.

**Changes:**
- Accept `{ previewId, audience }` instead of `{ segmentId }`
- Validate that `previewGeneratedAt` is within 30 minutes
- Read `previewHtml` from the newsletter row (no re-render)
- Create `newsletterBlockSnapshots` rows using data from the preview's block state
- Keep batch sending logic unchanged

---

## 9. New API Routes

### `POST /api/admin/newsletters/[id]/preview`

Generates the preview HTML and stores it in the `newsletters` row.

**Request body:**
```typescript
{
  blockSettings: {
    omer?: boolean;
    shoutout?: boolean;
    atr?: boolean;
    events?: boolean;
    simchas?: { enabled: boolean; types: string[] };
    blog?: boolean;
    tehillim?: boolean;
  }
}
```

**Response:**
```typescript
{
  previewHtml: string;       // Full email HTML
  previewGeneratedAt: string; // ISO timestamp
  blocksIncluded: string[];  // Which blocks had data and were rendered
  blocksSkipped: string[];   // Which blocks were enabled but had no data
}
```

**Server logic:**
1. Auth check (admin only)
2. Fetch newsletter from DB (title, subject, content HTML)
3. For each enabled block: run the block's data fetcher
4. Call `renderNewsletterHTML()` with all data
5. PATCH newsletter row: set `previewHtml`, `previewGeneratedAt`
6. Return response

### `POST /api/admin/newsletters/[id]/test-send`

Sends the current `previewHtml` to a specified email address.

**Request body:**
```typescript
{ to: string } // Any valid email address
```

**Response:** `{ success: boolean }`

**Server logic:**
1. Auth check (admin only)
2. Validate `previewGeneratedAt` within 30 minutes
3. Send `previewHtml` via Resend directly (single send, not batch)
4. Return success

### `GET /api/admin/newsletters/[id]/block-data`

Fetches live data for all block types. Used by the sidebar for live previews.

**Query params:** `blocks=omer,atr,events,simchas,blog,tehillim,shoutout&simchaTypes=birth,engagement`

**Response:**
```typescript
{
  omer: OmerData | null;
  shoutout: BusinessShoutoutData | null;
  atr: AtrQuestion[];
  events: EventData[];
  simchas: SimchaData[];
  blog: BlogPostData[];
  tehillim: TehillimEntry[];
}
```

Called once on sidebar open and when simcha types config changes. Results are shown as sidebar previews only — not used for actual send.

### `GET /api/admin/newsletters/[id]/recipient-count`

Returns estimated recipient count for the newsletter audience.

**Response:** `{ count: number }`

Queries: `SELECT COUNT(*) FROM email_subscribers WHERE newsletter = true`

### `PATCH /api/admin/newsletters/[id]/block-settings`

Saves block toggle states and config for a newsletter. Called on auto-save.

**Request body:**
```typescript
{
  settings: Array<{
    blockType: string;
    isEnabled: boolean;
    config?: object;
  }>
}
```

**Response:** `{ success: boolean }`

**Server logic:** Upsert into `newsletterBlockSettings` on `(newsletterId, blockType)`.

---

## 10. Modified API Routes

### `PATCH /api/admin/newsletters/[id]`

**File:** `src/app/api/admin/newsletters/[id]/route.ts`

Add `previewHtml` and `previewGeneratedAt` to the updatable fields (needed by the preview endpoint which patches via direct DB call — but these fields should also not be overwritten by a regular content PATCH unless explicitly passed).

**Change:** Exclude `previewHtml` and `previewGeneratedAt` from the body parse — only the preview endpoint sets those columns. Regular PATCH only updates `title`, `subject`, `previewText`, `content`, `contentJson`, `status`.

### `POST /api/admin/newsletters/[id]/send`

See Section 8 (Modified Components) for changes.

---

## 11. Email Template Changes

### Footer updates

Every sent newsletter must include three footer links:

1. **Unsubscribe from this newsletter** — links to `/newsletter/unsubscribe?token=[unsubscribeToken]&type=newsletter`
2. **Manage all notification preferences** — links to `/newsletter/preferences?token=[unsubscribeToken]`
3. **Unsubscribe from all emails** — links to `/newsletter/unsubscribe?token=[unsubscribeToken]&type=all`

These replace the current single unsubscribe link. Update `renderNewsletterHTML()` footer section and the existing `newsletter-template.ts` accordingly.

### Block section styling

All auto-content blocks must follow these style rules (inline CSS, table-based, no floats):

- **Section header:** `font-family: Arial, sans-serif; font-size: 20px; font-weight: bold; color: #111827; padding: 0 0 12px 0; border-bottom: 2px solid #3b82f6;`
- **Section container:** `padding: 24px 0;`
- **Item title:** `font-size: 16px; font-weight: 600; color: #111827;`
- **Item meta:** `font-size: 14px; color: #6b7280;`
- **Item body text:** `font-size: 15px; color: #374151; line-height: 1.6;`
- **CTA link:** `color: #2563eb; text-decoration: underline;`
- **Shoutout block background:** Light blue tint — `background-color: #eff6ff; padding: 16px; border-radius: 8px;` (border-radius is ignored in most email clients but doesn't break anything)
- **Omer block background:** Warm gold tint — `background-color: #fffbeb; padding: 16px;`

### Omer block email HTML

```html
<tr>
  <td style="background-color: #fffbeb; padding: 24px; text-align: center;">
    <p style="font-size: 13px; color: #92400e; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px 0;">Sefirat HaOmer</p>
    <p style="font-size: 28px; font-weight: bold; color: #78350f; margin: 0 0 4px 0;">Day [N] of the Omer</p>
    <p style="font-size: 16px; color: #92400e; margin: 0 0 12px 0;">[Hebrew day name, e.g. Lag BaOmer]</p>
    <p style="font-size: 14px; color: #b45309; font-style: italic; margin: 0;">[Full Hebrew/English formula]</p>
  </td>
</tr>
```

---

## 12. Edge Cases

### Preview expires before send

- "Send to All" button is disabled in the preview modal if `previewGeneratedAt` is more than 30 minutes ago
- UI shows: "Preview expired. Click 'Regenerate Preview' to send."
- Clicking Regenerate re-runs the preview endpoint with current block settings

### Block enabled but data disappears between preview and send

- Not possible: send uses the frozen `previewHtml` — data is already baked in at preview time
- The snapshot in `newsletterBlockSnapshots` records what was actually sent

### Business Shoutout table not yet created

- The shoutout block's data fetcher wraps its query in a try/catch
- If the `business_shoutouts` table doesn't exist, the catch returns `null` (block treated as empty/disabled)
- No error surfaces to the admin — shoutout block simply shows as "unavailable" in the sidebar

### Omer calculation edge cases

- On the 49th day (Erev Shavuot): show day 49, formula included
- On Shavuot itself: block hidden (period ended)
- On Pesach day 2 (when counting begins): show day 1
- Use `@hebcal/core` `Omer` class for all calculations — do not implement custom logic

### Simchas block with no types selected

- If admin deselects all simcha types in the picker, block card shows a validation warning: "Select at least one simcha type"
- Block is treated as empty (won't render in email) until at least one type is selected

### Newsletter with no TipTap content

- Preview and send are allowed even with empty TipTap content (some newsletters may be blocks-only)
- Empty TipTap content renders as an empty string in the main body section — no placeholder text injected

### Very large Tehillim list

- Cap the Tehillim block in the email at 50 names maximum
- If there are more than 50 active entries, the email footer of the Tehillim block includes: "And [N] more — view full list at frumtoronto.com/tehillim"

### Resend rate limits during batch send

- No change to batch send logic — keep existing 100/batch with 600ms delay

---

## 13. Migration Notes

### Schema migration steps

Run in order after deploying the schema changes:

```sql
-- 1. Create newsletter_block_snapshots table
CREATE TABLE newsletter_block_snapshots (
  id SERIAL PRIMARY KEY,
  newsletter_send_id INTEGER NOT NULL REFERENCES newsletter_sends(id) ON DELETE CASCADE,
  block_type VARCHAR(50) NOT NULL,
  snapshot_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 2. Create newsletter_block_settings table
CREATE TABLE newsletter_block_settings (
  id SERIAL PRIMARY KEY,
  newsletter_id INTEGER NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,
  block_type VARCHAR(50) NOT NULL,
  is_enabled BOOLEAN DEFAULT false NOT NULL,
  config JSONB,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE (newsletter_id, block_type)
);

-- 3. Add preview columns to newsletters table
ALTER TABLE newsletters
  ADD COLUMN IF NOT EXISTS preview_html TEXT,
  ADD COLUMN IF NOT EXISTS preview_generated_at TIMESTAMP;
```

Or use Drizzle push: `npm run db:push` after updating `schema.ts`.

### Segment deprecation

The `newsletterSegments` table is not dropped — existing data is preserved for historical reference. The segment dropdown in `NewsletterForm.tsx` is removed from the compose UI. The send API no longer accepts `segmentId`. Old `newsletterSends` rows that reference a `segmentId` are unaffected (historical data).

### Existing newsletters

Existing draft newsletters are unaffected. On first open of the redesigned compose page, `newsletterBlockSettings` has no rows for that newsletter — all blocks default to disabled. Admin enables blocks as desired.

### Backward compatibility on send API

The existing `/api/admin/newsletters/[id]/send` route currently accepts `{ segmentId, scheduledAt }`. After the overhaul it accepts `{ previewId, audience }`. Since sends are admin-only and triggered from the UI, there are no external callers to worry about. Deploy the new UI and API together.

---

*End of spec.*
