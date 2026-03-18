# Newsletter System Enhancements — Design Spec

**Date:** 2026-03-18
**Status:** Draft

## Overview

Enhance the admin newsletter system to support direct audience targeting by notification category, send test emails, preview emails, import subscribers via CSV, and exclude specific users from sends. Also remove the `userId` requirement so non-registered subscribers can receive emails.

## Current State

- Newsletter compose/edit with TipTap rich text editor
- Segment-based targeting (requires pre-creating named segments with filter criteria)
- Scheduling UI (no active cron — sends happen immediately)
- Subscriber CRUD (manual add/edit/delete)
- Resend batch API sending (100/batch, 600ms delay)
- Open/click tracking with 1x1 pixel and link wrapping
- Only subscribers with `userId` (registered users) receive emails

## Changes

### 1. Direct Audience Picker (replaces segments)

**Problem:** Admins must pre-create "segments" before they can target a subscriber group. This is an unnecessary extra step.

**Solution:** Replace the segment dropdown in the send dialog with a direct audience picker that maps to the 8 notification preference columns on `emailSubscribers`.

**Audience options:**
| Value | Label | DB Column |
|-------|-------|-----------|
| `all` | All Subscribers | _(no filter — all active, non-suppressed)_ |
| `newsletter` | Newsletter Subscribers | `newsletter = true` |
| `simchas` | Simchas Subscribers | `simchas = true` |
| `shiva` | Shiva Subscribers | `shiva = true` |
| `kosherAlerts` | Kosher Alerts Subscribers | `kosher_alerts = true` |
| `tehillim` | Tehillim Subscribers | `tehillim = true` |
| `communityEvents` | Community Events Subscribers | `community_events = true` |
| `communityAlerts` | Community Alerts Subscribers | `community_alerts = true` |
| `eruvStatus` | Eruv Status Subscribers | `eruv_status = true` |

**UI (Send Dialog):**
- Replace `<Select>` segment dropdown with audience category dropdown
- Show live subscriber count below the dropdown (fetched via API on selection change)
- The "Segments" link in the newsletters page header can be removed (or kept as legacy)

**API changes:**
- `POST /api/admin/newsletters/[id]/send` — accept `audience: string` instead of `segmentId: number`
- New endpoint: `GET /api/admin/newsletter-subscribers/count?audience=kosherAlerts` — returns count of matching subscribers

**Audience-to-column mapping:** The `audience` value uses camelCase application-level names (matching Drizzle column references), not raw SQL column names. The send logic maps `audience` to the corresponding Drizzle `emailSubscribers.*` field.

**Send logic:**
```
if audience === "all":
  filter: isActive=true, not unsubscribed, not suppressed
else:
  filter: isActive=true, not unsubscribed, not suppressed, [audience column] = true
```

**Important behavioral change:** The current system defaults to `newsletter = true` when no segment is selected. The new `all` option sends to **every** active subscriber regardless of preference flags. The UI should show a warning when "All Subscribers" is selected: _"This will send to all active subscribers, including those who only opted into specific notification types."_

### 2. Send Test Email

**Problem:** No way to preview how the email looks in an actual inbox before mass-sending.

**Solution:** "Send Test" button in the newsletter form header that sends the current content to any email address.

**UI:**
- New "Send Test" button in the form header (between "Save Draft" and "Schedule")
- Clicking opens a small dialog with:
  - Email input field (text input, any email)
  - "Send Test" button
- Toast confirmation on success/failure

**API:**
- New endpoint: `POST /api/admin/newsletters/[id]/send-test`
- Request body: `{ email: string }`
- Sends the newsletter content wrapped in the standard template
- **No tracking pixels**, no link wrapping, no recipient log entry
- Subject line prefixed with `[TEST] ` so it's clearly identifiable
- Uses a dummy unsubscribe token (not a real subscriber)

**Behavior:**
- "Send Test" button is **disabled** until the newsletter has been saved at least once (has an ID)
- Before sending, the client auto-saves if there are unsaved changes (same as current "Send Now" behavior)
- No status change on the newsletter — remains draft

### 3. Email Preview

**Problem:** Admin can only see raw TipTap editor output, not how it looks in the actual email template.

**Solution:** Inline preview tab + "Open in new tab" option.

**UI (Inline Preview):**
- Add a toggle above the editor: "Edit" | "Preview" tabs
- When "Preview" is selected:
  - Hide the TipTap editor
  - Show an `<iframe>` rendering the full email HTML (header, content, footer) at the same position
  - The iframe uses `srcdoc` with the rendered template HTML
  - **Security:** iframe must use `<iframe sandbox="" srcdoc="...">` (empty sandbox = maximum restrictions) to prevent script execution from admin-authored content
- "Open in New Tab" link/button next to the Preview tab

**API:**
- New endpoint: `GET /api/admin/newsletters/[id]/preview`
- Returns the full rendered HTML email template (same as what gets sent, but without tracking pixels/link wrapping and with placeholder unsubscribe links)
- Used by both the iframe `srcdoc` and the "open in new tab" functionality

**Client-side rendering option:** Alternatively, the preview can be rendered client-side by importing the template function. However, since the template is a server-side function, an API endpoint is cleaner and guarantees the preview matches what actually gets sent.

### 4. CSV Import

**Problem:** No way to bulk-add subscribers. Admin must add them one by one.

**Solution:** CSV import on the subscribers page.

**UI:**
- "Import CSV" button next to the search bar on the subscribers page
- Clicking opens a dialog/modal with:
  1. File upload zone (drag-and-drop or click to select `.csv`)
  2. Column mapping preview (auto-detect `email`, `firstName`/`first_name`, `lastName`/`last_name`)
  3. Default notification preferences for the batch (checkboxes for the 8 categories, defaulting to "Newsletter" checked)
  4. Preview table showing first 5 rows
  5. Summary: "X new subscribers will be added, Y duplicates will be skipped"
  6. "Import" button

**Processing:**
- Parse CSV client-side (using native `FileReader` + simple CSV parsing — no library needed for basic CSV)
- Validate emails client-side before sending to API
- Send validated rows to API in a single batch request

**API:**
- New endpoint: `POST /api/admin/newsletter-subscribers/import`
- Request body: `{ subscribers: Array<{ email, firstName?, lastName? }>, preferences: { newsletter: boolean, ... } }`
- Processing strategy (for performance):
  - Normalize all emails to lowercase
  - Generate `unsubscribeToken` for each row using `crypto.randomBytes(32).toString("hex")` (matching existing registration flow pattern)
  - Batch insert using `INSERT ... ON CONFLICT (email) DO NOTHING` — this skips duplicates in a single query without per-row lookups
  - Count inserted vs skipped by comparing `rowCount` with total submitted
- Response: `{ imported: number, skipped: number, errors: Array<{ email, reason }> }`

**Limits:**
- Max 2,000 rows per import (safe margin for Vercel Pro 60s timeout)
- Client-side: validate all emails before sending to API (fail fast on malformed data)
- If admin needs to import more, they can split the CSV and import in batches

### 5. Exclusion System

#### 5a. Permanent Suppression

**Problem:** No way to permanently prevent a subscriber from receiving any emails.

**Solution:** Add a `suppressed` boolean column to `emailSubscribers`.

**Schema change:**
```sql
ALTER TABLE email_subscribers ADD COLUMN suppressed BOOLEAN DEFAULT false;
```

**UI (Subscribers page):**
- New "Suppressed" badge on suppressed subscribers (red badge, similar to "Unsubscribed")
- Toggle suppression via the edit dialog or a quick-action button on the row
- Suppressed subscribers are visually distinct (grayed out row or red indicator)

**Sending logic:**
- Add `suppressed = false` to all subscriber queries when building send lists
- Suppressed overrides everything — even if they're active and subscribed, they don't receive emails

#### 5b. Per-Send Exclusion

**Problem:** Sometimes the admin wants to exclude specific people from just one newsletter send without permanently suppressing them.

**Solution:** Exclusion search in the send dialog.

**UI (Send Dialog):**
- Below the audience dropdown, an "Exclude specific subscribers" section
- Search input that queries subscribers by email or name (debounced, like existing search)
- Results appear as a dropdown list — click to add to exclusion list
- Excluded subscribers shown as removable chips/pills below the search
- Count updates to reflect exclusions: "Will send to X subscribers (Y excluded)"

**API changes:**
- `POST /api/admin/newsletters/[id]/send` — accept `excludeSubscriberIds: number[]` in addition to `audience`
- Max 200 exclusions per send (validated server-side). If admin needs to exclude more, permanent suppression is the right tool.
- Sending query adds: `AND id NOT IN (excludeSubscriberIds)` when exclusions are present
- Exclusion list stored on the `newsletterSends` record for audit purposes

**Schema change:**
```sql
ALTER TABLE newsletter_sends ADD COLUMN excluded_subscriber_ids INTEGER[] DEFAULT '{}';
```

### 6. Remove userId Requirement

**Problem:** Only registered users (with `userId` linked) receive emails. Manually added or imported subscribers without accounts get nothing.

**Solution:** Remove the `isNotNull(emailSubscribers.userId)` condition from the send query.

**Files to change:**
- `src/app/api/admin/newsletters/[id]/send/route.ts` — remove `isNotNull(emailSubscribers.userId)` from conditions array (line 83)

**Impact:**
- All active, non-unsubscribed, non-suppressed subscribers can now receive emails
- The info banner on the subscribers page ("Only subscribers with linked user accounts receive emails") should be updated or removed
- Manually added and CSV-imported subscribers will immediately be eligible

### 7. Schedule Dialog Update

The schedule dialog (`showScheduleDialog`) in `NewsletterForm.tsx` also uses the segment dropdown. It must receive the same updates as the send dialog: audience picker, exclusion search, and live subscriber count.

### 8. Pre-existing Bugs to Fix

The following gaps exist in the current codebase and should be fixed as part of this work:

- **`communityAlerts` missing from `FilterCriteria` type** in `src/types/newsletter.ts` — not currently in the interface
- **`communityAlerts` missing from `filterCriteriaSchema`** in `src/lib/validations/newsletter.ts` — not validated
- **`communityAlerts` missing from `SEGMENT_FILTER_OPTIONS`** in `src/lib/validations/newsletter.ts` — not shown in segment UI
- **`communityAlerts` missing from subscriber add/edit dialog** in `src/app/(admin)/admin/newsletters/subscribers/page.tsx` — admin can't toggle it
- **`communityAlerts` missing from segments page** `SUBSCRIPTION_OPTIONS` array in `src/app/(admin)/admin/newsletters/segments/page.tsx`
- **Missing "Add Subscriber" button** on the subscribers page — the `showAddDialog` state exists but no button triggers it. Add a `+ Add` button in the header.

### 9. Segments Cleanup

Since segments are being replaced by direct audience targeting:

- **Remove** the "Segments" button from the newsletters page header
- **Keep** the database tables (`newsletterSegments`) and API routes — no destructive changes. They simply won't be used in the UI anymore.
- **Remove** segment selection from the send and schedule dialogs
- The `segmentId` column on `newsletterSends` remains but will be null going forward

## Files to Create

| File | Purpose |
|------|---------|
| `src/app/api/admin/newsletters/[id]/send-test/route.ts` | Send test email endpoint |
| `src/app/api/admin/newsletters/[id]/preview/route.ts` | Preview rendered HTML endpoint |
| `src/app/api/admin/newsletter-subscribers/import/route.ts` | CSV import endpoint |
| `src/app/api/admin/newsletter-subscribers/count/route.ts` | Subscriber count by audience |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/NewsletterForm.tsx` | Add Send Test button/dialog, Preview tab/iframe, replace segment dropdown with audience picker in send dialog, add per-send exclusion |
| `src/app/api/admin/newsletters/[id]/send/route.ts` | Accept `audience` + `excludeSubscriberIds` instead of `segmentId`, remove `userId` requirement, add `suppressed` filter |
| `src/app/(admin)/admin/newsletters/page.tsx` | Remove "Segments" button from header |
| `src/app/(admin)/admin/newsletters/subscribers/page.tsx` | Add CSV import button/dialog, add suppression toggle/badge |
| `src/lib/db/schema.ts` | Add `suppressed` column to `emailSubscribers`, add `excludedSubscriberIds` to `newsletterSends` |
| `src/lib/validations/newsletter.ts` | Add import schema, update send schema, add `suppressed` to subscriber schema, add `communityAlerts` to `filterCriteriaSchema` and `SEGMENT_FILTER_OPTIONS` |
| `src/types/newsletter.ts` | Add `suppressed` to `EmailSubscriber`, add `excludedSubscriberIds` and `audience` to `NewsletterSend`, add `communityAlerts` to `FilterCriteria` |
| `src/lib/email/newsletter-template.ts` | Export a preview variant without tracking |

## Schema Changes Summary

```sql
-- Add suppression to email_subscribers
ALTER TABLE email_subscribers ADD COLUMN suppressed BOOLEAN DEFAULT false;

-- Add exclusion tracking to newsletter_sends
ALTER TABLE newsletter_sends ADD COLUMN excluded_subscriber_ids INTEGER[] DEFAULT '{}';

-- Add audience column to newsletter_sends (for audit — what audience was targeted)
ALTER TABLE newsletter_sends ADD COLUMN audience VARCHAR(50) DEFAULT 'all';
```

## Edge Cases

- **Preview before first save:** Disabled. Newsletter must be saved at least once before preview/test works (needs an ID).
- **Empty audience:** If selected audience has 0 matching subscribers, show a clear message and disable the send button.
- **CSV with no email column:** Show error asking user to ensure CSV has an `email` column.
- **Duplicate exclusion:** If admin tries to exclude the same person twice, silently deduplicate.
- **Suppressed + excluded overlap:** Suppressed users are already excluded from all sends; per-send exclusion is additive. No conflict.
- **Test email to non-existent address:** Let Resend handle the bounce — just show "Test sent" on the UI side.
- **Send test before first save:** "Send Test" button disabled until newsletter has an ID (same as Preview).
- **Double-send prevention:** Existing guard (newsletter status check for "sent"/"sending") is preserved — no changes needed.
- **"All" audience warning:** UI shows a warning note when "All Subscribers" is selected, reminding admin this includes people who only opted into specific notification types.
