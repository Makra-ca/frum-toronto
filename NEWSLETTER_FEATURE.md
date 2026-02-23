# Newsletter Feature Implementation

## Overview
Full-featured newsletter system for Frum Toronto admin panel with rich text editing, subscriber segments, scheduling, and analytics.

---

## Status: COMPLETE ✓

### All Tasks Completed
- [x] Database schema (4 new tables + updated emailSubscribers)
- [x] TipTap dependencies installed
- [x] TypeScript types (`src/types/newsletter.ts`)
- [x] Zod validation schemas (`src/lib/validations/newsletter.ts`)
- [x] TipTap editor components (`src/components/newsletter/`)
- [x] Newsletter API routes (CRUD)
- [x] Segment API routes (CRUD)
- [x] Subscriber API routes (CRUD)
- [x] Admin pages (list, create, edit, subscribers, segments)
- [x] Admin sidebar navigation updated
- [x] Newsletter email template
- [x] Batch sending system (cron job)
- [x] Open/click tracking endpoints
- [x] Unsubscribe page and API
- [x] Preferences management page
- [x] Vercel cron configuration
- [x] Database migration applied

---

## Database Schema

### New Tables (in `src/lib/db/schema.ts`)

```typescript
// newsletters - Main newsletter content
newsletters: id, title, subject, previewText, content, contentJson, status, scheduledAt, sentAt, createdBy, createdAt, updatedAt

// newsletterSegments - Subscriber segments for targeting
newsletterSegments: id, name, description, filterCriteria (jsonb), isDefault, createdAt

// newsletterSends - Track each send operation
newsletterSends: id, newsletterId, segmentId, totalRecipients, sentCount, failedCount, openCount, clickCount, status, startedAt, completedAt, errorMessage

// newsletterRecipientLogs - Individual recipient tracking
newsletterRecipientLogs: id, sendId, subscriberId, email, status, resendMessageId, openedAt, clickedAt, errorMessage, sentAt
```

### Updated Table
```typescript
// emailSubscribers - Added fields:
newsletter: boolean (default true)
unsubscribeToken: varchar(64)
unsubscribedAt: timestamp
```

### Migration Required
Run: `npm run db:push` to apply schema changes

---

## File Structure

### All Created Files

```
# Types & Validation
src/types/newsletter.ts                    # TypeScript types
src/lib/validations/newsletter.ts          # Zod schemas

# Editor Components
src/components/newsletter/
  index.ts                                 # Exports
  NewsletterEditor.tsx                     # TipTap rich text editor
  EditorToolbar.tsx                        # Formatting toolbar

# Admin Form Component
src/components/admin/NewsletterForm.tsx    # Create/edit newsletter form

# Admin Pages
src/app/(admin)/admin/newsletters/
  page.tsx                                 # List all newsletters
  new/page.tsx                             # Create new newsletter
  [id]/page.tsx                            # Edit newsletter
  subscribers/page.tsx                     # Manage subscribers
  segments/page.tsx                        # Manage segments

# Admin API Routes
src/app/api/admin/newsletters/
  route.ts                                 # GET list, POST create
  [id]/route.ts                            # GET, PUT, DELETE single
  [id]/send/route.ts                       # POST initiate send

src/app/api/admin/newsletter-segments/
  route.ts                                 # GET list, POST create
  [id]/route.ts                            # GET, PUT, DELETE single

src/app/api/admin/newsletter-subscribers/
  route.ts                                 # GET list, POST create
  [id]/route.ts                            # GET, PUT, DELETE single

# Email Template
src/lib/email/newsletter-template.ts       # HTML email template with tracking

# Cron Job
src/app/api/cron/newsletter-send/route.ts  # Batch sending processor

# Tracking Endpoints
src/app/api/newsletter/track/open/route.ts   # Open tracking (pixel)
src/app/api/newsletter/track/click/route.ts  # Click tracking (redirect)

# Public Pages
src/app/api/newsletter/unsubscribe/route.ts  # Unsubscribe API
src/app/newsletter/unsubscribe/page.tsx      # Unsubscribe page
src/app/newsletter/preferences/page.tsx      # Email preferences page

# Vercel Config
vercel.json                                # Cron job configuration
```

### Modified Files
```
src/lib/db/schema.ts                       # Added 4 newsletter tables
src/components/admin/AdminSidebar.tsx      # Added Newsletters nav item
```

---

## Features

### 1. Rich Text Editor (TipTap)
- Bold, italic, underline, strikethrough
- Headings (H1, H2, H3)
- Bullet/numbered lists
- Links with custom text
- Images (upload to Vercel Blob)
- YouTube embeds
- Text alignment, colors
- **HTML toggle** - switch between visual and raw HTML

### 2. Subscriber Segments
Filter subscribers by preferences:
- Newsletter (general)
- Kosher Alerts
- Eruv Status
- Simchas
- Shiva

### 3. Scheduling
- Send immediately
- Schedule for later (date/time picker)

### 4. Batch Sending (for 5-7k emails)
Strategy:
1. Admin clicks "Send" → Creates send record + recipient logs
2. Cron job runs every minute → Processes 500 emails per run
3. Uses Resend batch API (100 emails per request)
4. Estimated time for 7k emails: ~14 minutes

### 5. Tracking
- **Open tracking**: 1x1 transparent GIF pixel embedded in email
- **Click tracking**: All links wrapped with redirect through tracking endpoint
- Stats updated on `newsletterSends` record (openCount, clickCount)

### 6. Unsubscribe
- One-click unsubscribe from all emails
- Preferences page to manage individual subscriptions
- Token-based authentication (no login required)

---

## API Endpoints

### Newsletters
```
GET    /api/admin/newsletters              # List newsletters
POST   /api/admin/newsletters              # Create newsletter
GET    /api/admin/newsletters/:id          # Get single
PUT    /api/admin/newsletters/:id          # Update
DELETE /api/admin/newsletters/:id          # Delete
POST   /api/admin/newsletters/:id/send     # Initiate send
```

### Segments
```
GET    /api/admin/newsletter-segments      # List segments (with subscriber counts)
POST   /api/admin/newsletter-segments      # Create segment
GET    /api/admin/newsletter-segments/:id  # Get single
PUT    /api/admin/newsletter-segments/:id  # Update
DELETE /api/admin/newsletter-segments/:id  # Delete
```

### Subscribers
```
GET    /api/admin/newsletter-subscribers      # List subscribers
POST   /api/admin/newsletter-subscribers      # Add subscriber
GET    /api/admin/newsletter-subscribers/:id  # Get single
PUT    /api/admin/newsletter-subscribers/:id  # Update
DELETE /api/admin/newsletter-subscribers/:id  # Delete
```

### Public/Tracking
```
GET  /api/newsletter/track/open?sid=X&sub=Y     # Open tracking pixel
GET  /api/newsletter/track/click?sid=X&sub=Y&url=Z  # Click redirect
GET  /api/newsletter/unsubscribe?token=X        # Get subscriber info
POST /api/newsletter/unsubscribe                # Full unsubscribe
PUT  /api/newsletter/unsubscribe                # Update preferences
```

### Cron
```
GET  /api/cron/newsletter-send                  # Process pending sends
```

---

## Environment Variables

Already configured:
- `RESEND_API_KEY` - For sending emails
- `EMAIL_FROM` - Sender address (e.g., "FrumToronto <noreply@frumtoronto.com>")

Should add for production:
- `CRON_SECRET` - For securing cron endpoint (prevents unauthorized calls)

---

## How to Use

### Creating a Newsletter
1. Go to Admin > Newsletters
2. Click "New Newsletter"
3. Fill in title (internal), subject line, preview text
4. Write content using the rich text editor
5. Toggle to HTML view if you want to paste raw HTML
6. Click "Save Draft"

### Sending a Newsletter
1. Open the newsletter in edit mode
2. Click "Send Now" or "Schedule"
3. Select target segment (or all newsletter subscribers)
4. Confirm send

### Managing Subscribers
1. Go to Admin > Newsletters > Subscribers
2. Add subscribers manually or view/edit existing ones
3. Filter by search

### Creating Segments
1. Go to Admin > Newsletters > Segments
2. Create a segment with a name and filter criteria
3. Use segments when sending to target specific groups

---

## Testing Checklist

- [ ] Create newsletter draft
- [ ] Edit newsletter content
- [ ] Use HTML toggle in editor
- [ ] Delete newsletter
- [ ] Add subscriber manually
- [ ] Create segment
- [ ] Send newsletter to segment
- [ ] Schedule newsletter
- [ ] Verify batch sending works (check recipient logs)
- [ ] Test unsubscribe link
- [ ] Test preferences page
- [ ] Verify open tracking (check network requests)
- [ ] Verify click tracking (links redirect correctly)

---

## Notes

- Using Resend Pro ($20/mo USD) for 50k emails/month
- Batch sending respects rate limits (2 req/sec)
- TipTap stores content as JSON for editing, HTML for sending
- Unsubscribe tokens are 64-char random hex strings
- Open tracking only counts unique opens (first time only)
- Click tracking only counts unique clicks per subscriber
- Cron job runs every minute on Vercel (requires Pro plan for sub-daily)

---

## Future Enhancements (Not Implemented)
- CSV import for bulk subscriber upload
- Send history/analytics dashboard with charts
- A/B testing for subject lines
- Bounce handling webhooks from Resend
- Duplicate newsletter functionality
- Newsletter templates/presets
