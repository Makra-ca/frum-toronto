# Events System Enhancements

## 1. Overview

The current events system has a functional backend but several gaps: `imageUrl` exists in the schema but is never surfaced in the form; there is no public submission flow (the `UpcomingEvents` component links to `/community/calendar/new` which does not exist); and there is no coordination tooling to help organizers avoid scheduling conflicts.

This spec covers:

- Three new schema fields (`flyerUrl`, `websiteUrl`, `organization`)
- Image upload wired into the existing `imageUrl` field
- "Copy from previous event" auto-fill on the event form
- Conflict detection modal with email notification to affected organizers
- Email broadcast to `communityEvents` subscribers when an event goes live
- Public event submission page (`/community/calendar/new`)
- Shul dashboard event creation
- Homepage `UpcomingEvents` grid updated to 6 events with a CTA row

---

## 2. Database Schema Changes

### 2.1 `events` table — new columns

File: `src/lib/db/schema.ts`

```
flyerUrl        varchar(500)     nullable   -- PDF or image download
websiteUrl      varchar(500)     nullable   -- external event website
organization    varchar(200)     nullable   -- free-text org name, autocomplete-assisted
```

Add these after the existing `imageUrl` column.

Drizzle definition:

```typescript
flyerUrl: varchar("flyer_url", { length: 500 }),
websiteUrl: varchar("website_url", { length: 500 }),
organization: varchar("organization", { length: 200 }),
```

### 2.2 No new tables

Organizations are stored inline on events. Autocomplete pulls `DISTINCT organization` values from the `events` table at query time. No separate table is needed.

### 2.3 Migration

Run `npm run db:push` after updating the schema. No data migration required — all three columns are nullable with no defaults.

---

## 3. New Components

### 3.1 `OrganizationAutocomplete`

**File:** `src/components/events/OrganizationAutocomplete.tsx`

Client component. A text input that fetches suggestions from `/api/events/organizations?q=<term>` (debounced 300ms, min 2 chars). Renders a dropdown of matching organization names. User can select a suggestion or type freely. Accepts standard `value` / `onChange` props compatible with react-hook-form `Controller`.

Props:
```typescript
interface OrganizationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}
```

### 3.2 `CopyFromPreviousEvent`

**File:** `src/components/events/CopyFromPreviousEvent.tsx`

Client component. A `<Select>` (shadcn/ui) listing the current user's last 5 events (title + formatted date). Appears at the top of the event form, above all fields. Selecting an event calls a provided `onCopy` callback with the pre-fill data object. Fetches from `/api/events/my-recent` on mount.

Props:
```typescript
interface CopyFromPreviousEventProps {
  onCopy: (data: EventPrefillData) => void;
}

interface EventPrefillData {
  description: string | null;
  location: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  organization: string | null;
  eventType: string | null;
}
```

Fields explicitly NOT pre-filled: `title`, `startTime`, `endTime`, `flyerUrl`, `imageUrl`, `websiteUrl`.

### 3.3 `EventConflictModal`

**File:** `src/components/events/EventConflictModal.tsx`

Client component. A shadcn/ui `Dialog` shown when the API returns a `conflicts` array on event creation.

Props:
```typescript
interface EventConflictModalProps {
  conflicts: ConflictingEvent[];
  onCancel: () => void;
  onProceed: () => void;
}

interface ConflictingEvent {
  id: number;
  title: string;
  startTime: string;    // ISO string
  contactName: string | null;
  organization: string | null;
}
```

Display: List of conflicting events with title, time, and organizer name. Two buttons: "Cancel" (closes modal, does not submit) and "Schedule Anyway" (calls `onProceed`).

### 3.4 `PublicEventForm`

**File:** `src/components/events/PublicEventForm.tsx`

Client component. Same fields as admin `EventForm` minus `shulId` and minus the admin-only `approvalStatus` override. Includes `CopyFromPreviousEvent` at the top. Uses the same Zod schema validation. On submit, POSTs to `/api/community/events`.

Fields shown: title, organization (with `OrganizationAutocomplete`), eventType, startTime, endTime, isAllDay, location, description, imageUrl (file upload), flyerUrl (file upload), websiteUrl, contactName, contactEmail, contactPhone, cost.

---

## 4. Modified Components

### 4.1 `EventForm` (`src/components/admin/EventForm.tsx`)

**Changes:**

1. **Add `organization` field** — use `OrganizationAutocomplete` component, placed after `eventType`.

2. **Add `websiteUrl` field** — standard text input, placed after `contactPhone`.

3. **Add `flyerUrl` field** — file upload using `@vercel/blob` (same pattern as `imageUrl`). Accept `.pdf`, `.jpg`, `.jpeg`, `.png`. Label: "Flyer (PDF or image)". Show existing flyer as a download link if already set. Placed after `imageUrl`.

4. **Wire `imageUrl` upload** — Currently hardcoded to `null`. Replace with actual file input using Vercel Blob upload (`/api/upload` endpoint). Accept `.jpg`, `.jpeg`, `.png`, `.webp`. Show existing image preview if set.

5. **Add `CopyFromPreviousEvent`** at the top of the form (before the title field). Only render this component when the form is in "create" mode (no `initialData.id`).

6. **Conflict detection** — After form submit and before the final API call, check for conflicts via `GET /api/events/conflicts?date=<YYYY-MM-DD>`. If conflicts returned, show `EventConflictModal`. If user clicks "Cancel", abort. If user clicks "Schedule Anyway", set `forceSchedule: true` on the POST body and re-submit.

### 4.2 `UpcomingEvents` (`src/components/home/UpcomingEvents.tsx`)

**Changes:**

1. Change fetch from 4 events to 6 events (update `limit` query param on the API call).

2. Change layout from current display (verify existing structure before implementing) to a 3-column CSS grid with 2 rows of 3 cards each.

   ```html
   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
     {events.map(...)}
     {/* 7th item: full-width CTA */}
     <div className="col-span-1 sm:col-span-2 lg:col-span-3">
       <Link href="/community/calendar">See all upcoming events →</Link>
     </div>
   </div>
   ```

3. Fix the broken "Submit an event" link from `/community/calendar/new` — this will now work once the public submission page is created.

### 4.3 Admin Events page (`src/app/(admin)/admin/programs/events/page.tsx`)

No structural changes. The admin `EventForm` changes (above) apply here automatically since the page renders `EventForm`.

### 4.4 Shul dashboard page (`src/app/(dashboard)/dashboard/shuls/[id]/page.tsx`)

**Add an "Events" section** to the shul detail page in the dashboard. This section shows:

- A list of events associated with this shul (`shulId = this shul's id`), ordered by `startTime DESC`, showing the most recent 10.
- An "Add Event" button that opens a drawer or navigates to a create form.

When creating an event from the shul dashboard:
- `shulId` is pre-set to the current shul's id (hidden field, not user-editable).
- The form is the same `EventForm` component with `defaultValues.shulId` set.
- The user must be assigned to this shul in `userShuls` (enforced server-side).

Use the existing `EventForm` admin component. Gate behind `canUserManageShul(userId, shulId, userRole)` check in the API.

---

## 5. New API Routes

### 5.1 `GET /api/events/organizations`

**File:** `src/app/api/events/organizations/route.ts`

Returns distinct organization values matching a search term. Used by `OrganizationAutocomplete`.

Query params: `q` (string, required, min 2 chars)

```typescript
// Query
SELECT DISTINCT organization
FROM events
WHERE organization ILIKE '%' || q || '%'
  AND organization IS NOT NULL
  AND organization != ''
ORDER BY organization
LIMIT 10;
```

Response: `{ organizations: string[] }`

No auth required (public autocomplete data).

### 5.2 `GET /api/events/my-recent`

**File:** `src/app/api/events/my-recent/route.ts`

Returns the current user's last 5 created events. Requires authentication.

```typescript
// Query
SELECT id, title, start_time, description, location, contact_name,
       contact_email, contact_phone, organization, event_type
FROM events
WHERE user_id = currentUserId
ORDER BY created_at DESC
LIMIT 5;
```

Response:
```typescript
{
  events: Array<{
    id: number;
    title: string;
    startTime: string;
    description: string | null;
    location: string | null;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    organization: string | null;
    eventType: string | null;
  }>
}
```

### 5.3 `GET /api/events/conflicts`

**File:** `src/app/api/events/conflicts/route.ts`

Checks for approved active events on the same calendar day as the requested date. Used client-side before submitting the event form.

Query params: `date` (string, `YYYY-MM-DD`, required)

```typescript
// Query — events that overlap with the given calendar day (Eastern time)
SELECT e.id, e.title, e.start_time, e.contact_name, e.organization,
       e.contact_email, u.email AS creator_email
FROM events e
LEFT JOIN users u ON u.id = e.user_id
WHERE e.approval_status = 'approved'
  AND e.is_active = true
  AND DATE(e.start_time AT TIME ZONE 'America/Toronto') = :date
ORDER BY e.start_time ASC;
```

Response:
```typescript
{
  conflicts: Array<{
    id: number;
    title: string;
    startTime: string;
    contactName: string | null;
    organization: string | null;
  }>
}
```

Returns `{ conflicts: [] }` when no conflicts exist. No auth required (conflict check is pre-submission).

### 5.4 `POST /api/community/events`

**File:** `src/app/api/community/events/route.ts`

Public event submission endpoint. Requires authentication.

Request body: same fields as admin event creation minus `shulId` and `approvalStatus`. Plus `forceSchedule: boolean` (optional, defaults false).

Logic:
1. Authenticate user. Return 401 if not logged in.
2. Validate body against `publicEventSchema` (Zod).
3. If `forceSchedule` is false, run conflict check (same query as 5.3). If conflicts found, return `{ conflicts: [...] }` with status 200 (not an error — client handles the modal).
4. Determine `approvalStatus`:
   - If `user.canAutoApproveEvents = true` → `"approved"`
   - Otherwise → `"pending"`
5. Insert event row. Set `userId` to authenticated user's id.
6. If `approvalStatus === "approved"` AND `forceSchedule` was false (first time going live): send conflict notification emails (see Section 8.2) AND send subscriber broadcast email (see Section 8.1).
7. If `forceSchedule` is true and event is auto-approved: send conflict notification emails to conflicting organizers.
8. Return `{ event: { id, slug } }` on success.

### 5.5 `GET /api/events/[id]/flyer` (optional download redirect)

Not strictly required if `flyerUrl` is a direct Vercel Blob URL. Skip this unless a signed URL pattern is needed. The `flyerUrl` can be rendered as a direct `<a href={flyerUrl} download>` link on the public event detail page.

---

## 6. Modified API Routes

### 6.1 `POST /api/admin/events` (admin event creation)

**File:** `src/app/api/admin/events/route.ts` (verify exact path)

**Changes:**

1. Add `flyerUrl`, `websiteUrl`, `organization` to the accepted body fields and insert them into the DB.
2. Add `forceSchedule: boolean` to the body (default false).
3. Conflict check: same logic as public endpoint (5.4, steps 3 and 7).
4. When `approvalStatus === "approved"` on creation: trigger subscriber broadcast email (Section 8.1) and conflict notification emails if `forceSchedule` is true.

### 6.2 `PATCH /api/admin/events/[id]` (admin event update)

**File:** `src/app/api/admin/events/[id]/route.ts` (verify exact path)

**Changes:**

1. Add `flyerUrl`, `websiteUrl`, `organization` to accepted update fields.
2. **Approval trigger**: When the PATCH changes `approvalStatus` from anything to `"approved"`, send the subscriber broadcast email (Section 8.1). Check the previous value before updating:

```typescript
const [existing] = await db.select({ approvalStatus: events.approvalStatus })
  .from(events).where(eq(events.id, id));

// ... perform update ...

if (existing.approvalStatus !== "approved" && body.approvalStatus === "approved") {
  await sendEventLiveEmail(updatedEvent);
}
```

### 6.3 `/api/upload`

**File:** `src/app/api/upload/route.ts`

**Changes:**

Verify the current allowed MIME types. Add `application/pdf` if not already present, and set max size to 10MB for PDF uploads. The same endpoint handles both image and flyer uploads — the client sends a `type` param (`image` or `flyer`) for logging/routing purposes if needed, but the upload logic is the same.

### 6.4 Admin events list (`GET /api/admin/events`)

Add `organization` to the returned event fields so the admin table can optionally display it. No other changes required.

### 6.5 Public events API (`GET /api/events` or equivalent)

Ensure `organization`, `flyerUrl`, and `websiteUrl` are returned in the response so the event detail page can display them.

---

## 7. User Flows

### 7.1 Public user submitting an event

1. User visits `/community/calendar`.
2. Clicks "Submit an Event" button (already links to `/community/calendar/new`).
3. If not logged in: redirected to `/login?callbackUrl=/community/calendar/new`.
4. If logged in: lands on `/community/calendar/new`.
5. Optional: selects a previous event from "Copy from previous event" dropdown. Form fields auto-fill.
6. Fills in all required fields (title, startTime, eventType minimum).
7. Uploads a cover image and/or flyer via file inputs (both optional).
8. Clicks "Submit Event".
9. Client calls `GET /api/events/conflicts?date=YYYY-MM-DD`.
   - If no conflicts: proceeds directly to submit.
   - If conflicts: `EventConflictModal` appears. User clicks "Cancel" (stops) or "Schedule Anyway" (re-submits with `forceSchedule: true`).
10. `POST /api/community/events` is called.
11. Success: user sees a toast — "Your event has been submitted for review" (pending) or "Your event has been published" (auto-approved).
12. User is redirected to `/community/calendar`.

### 7.2 Admin creating an event

1. Admin visits `/admin/programs/events`.
2. Clicks "Add Event".
3. "Copy from previous event" dropdown appears at top (shows admin's own recent events).
4. Admin fills in the form including new fields (organization, websiteUrl, flyerUrl).
5. Admin sets `approvalStatus` to `"approved"` (or any other status).
6. Clicks "Save".
7. Client calls `GET /api/events/conflicts?date=YYYY-MM-DD`.
   - If conflicts: `EventConflictModal` shows. Admin can cancel or schedule anyway.
8. If approved + force scheduled: conflict notification emails sent to other organizers.
9. If approved (any path): subscriber broadcast email sent.
10. Admin sees success toast and returns to events list.

### 7.3 Admin approving a pending event

1. Admin visits `/admin/approvals` or `/admin/programs/events`.
2. Finds pending event, clicks "Approve" (or edits and sets `approvalStatus: "approved"`).
3. PATCH API detects status transition → triggers subscriber broadcast email.
4. No conflict check on approval (conflict check only on creation).

### 7.4 Shul manager creating an event

1. Shul manager visits `/dashboard/shuls/[id]`.
2. Sees "Events" section at the bottom of the page.
3. Clicks "Add Event".
4. Opens event creation form with `shulId` pre-set and locked.
5. Same flow as 7.1 (conflict check, submit, etc.).
6. `POST /api/community/events` is called with `shulId` in body.
7. API verifies `canUserManageShul(userId, shulId, userRole)`. Returns 403 if not authorized.
8. Event created with `shulId` set.

### 7.5 Conflict notification (background, no user action)

Triggered automatically when a new approved event is created with `forceSchedule: true`:

1. System queries conflicting events (same date, approved, active).
2. For each conflicting event:
   - Notification email recipient = `event.contactEmail` if set; otherwise `users.email` where `users.id = event.userId`.
   - Sends conflict notification email (Section 8.2).
3. Errors during email send are caught and logged. They do NOT fail the event creation.

---

## 8. Email Templates

### 8.1 Event Live Broadcast Email

**Trigger:** `approvalStatus` becomes `"approved"` (create or update).
**Recipients:** `email_subscribers` WHERE `community_events = true` AND `is_subscribed = true`.
**Sender:** `EMAIL_FROM` env var.
**Subject:** `New Event: {event.title} — {formattedDate}`

**Send function:** `sendEventLiveEmail(event: EventRow): Promise<void>`
**File:** Add to `src/lib/email/send.ts`

```typescript
export async function sendEventLiveEmail(event: EventRow): Promise<void> {
  if (!resend) return;

  const subscribers = await db
    .select({ email: emailSubscribers.email })
    .from(emailSubscribers)
    .where(
      and(
        eq(emailSubscribers.communityEvents, true),
        eq(emailSubscribers.isSubscribed, true),
        isNotNull(emailSubscribers.userId)
      )
    );

  if (subscribers.length === 0) return;

  const html = buildEventLiveEmailHtml(event);

  // Send in batches of 100 using Resend batch API
  const batches = chunk(subscribers, 100);
  for (const batch of batches) {
    await resend.batch.send(
      batch.map(s => ({
        from: EMAIL_FROM,
        to: s.email,
        subject: `New Event: ${event.title} — ${formatEventDate(event.startTime)}`,
        html,
      }))
    );
  }
}
```

**HTML content (table-based, inline styles):**

```
[FrumToronto logo / header]

New Community Event

[Event Title]
[Event Type badge]

Date & Time: [formatted date and time, or "All Day" if isAllDay]
Location: [location or "TBD"]
[Cost: $X | Free (omit if null)]
[Organization: X (omit if null)]

[Short description excerpt — first 300 chars of plain text]

[View Event Details button → {NEXT_PUBLIC_APP_URL}/community/calendar/{id}]

[flyerUrl present? → "Download Flyer" link]
[websiteUrl present? → "Event Website" link]

---
You're receiving this because you subscribed to community event notifications.
[Manage preferences link] | [Unsubscribe link]
```

### 8.2 Conflict Notification Email

**Trigger:** New approved event created with `forceSchedule: true`.
**Recipients:** `contactEmail` of each conflicting event (fallback: `users.email` of the event creator).
**Subject:** `Heads up: Another event is scheduled on {date}`

**Send function:** `sendEventConflictNotificationEmail(newEvent: EventRow, recipientEmail: string): Promise<void>`
**File:** Add to `src/lib/email/send.ts`

**HTML content (table-based, inline styles):**

```
[FrumToronto logo / header]

Event Scheduling Notice

Hi,

A new event has been added to the FrumToronto community calendar on the same day as your event.

New event:
  Title: [newEvent.title]
  Organization: [newEvent.organization or "—"]
  Date: [formatted date]
  Time: [formatted time or "All Day"]

You may want to reach out to coordinate. If you have any concerns, please contact us.

[View the new event →]

---
This notice was sent because another organizer scheduled an event on the same day as yours.
You can manage your event's contact email at {NEXT_PUBLIC_APP_URL}/community/calendar/{conflictingEventId}
```

No unsubscribe link needed — this is a transactional organizer notification, not a broadcast.

---

## 9. Edge Cases & Validation

### 9.1 Conflict detection edge cases

- **All-day events**: When `isAllDay = true`, use the date portion of `startTime` for conflict matching. The conflict query uses `DATE(start_time AT TIME ZONE 'America/Toronto')` which handles both timed and all-day events consistently.
- **Multi-day events**: If an event spans multiple days (endTime > startTime + 1 day), conflict is only checked against the `startTime` date. Extended conflict checking (checking all days in range) is out of scope for v1.
- **Event editing**: Conflict check only runs on creation (POST), not on update (PATCH). If a user edits an event's date, no conflict check is triggered. Out of scope for v1.
- **Self-conflict**: The conflict check on an edit should exclude the event itself. Since conflict check only runs on creation, this is not an issue.
- **No conflicts for pending events**: The conflict query filters for `approval_status = 'approved'` only. A newly submitted pending event does not trigger conflicts against other pending events.

### 9.2 Organization autocomplete

- If no events have an `organization` value yet, the autocomplete returns an empty list. The field still accepts free text.
- Organization values are case-insensitive in the autocomplete query (`ILIKE`), but stored exactly as entered.
- Max length: 200 chars (enforced at Zod schema level and DB column).

### 9.3 File uploads

- `flyerUrl` accepts PDF, JPG, JPEG, PNG. Max 10MB (same as shul documents).
- `imageUrl` (cover image) accepts JPG, JPEG, PNG, WEBP. Max 5MB.
- Both use Vercel Blob via `/api/upload`. Store the returned blob URL in the respective field.
- If upload fails, show an error toast. The rest of the form remains intact.
- Existing files: If `flyerUrl` or `imageUrl` already has a value (edit mode), show a preview/link and a "Replace" option. Uploading a new file replaces the old URL (Vercel Blob old file is not deleted automatically — out of scope for v1).

### 9.4 Email broadcast timing

- The subscriber broadcast email is sent synchronously in the API route (awaited), per the global rule for serverless environments (Vercel).
- If the email send fails, log the error but do NOT fail the event creation/approval. The event is saved regardless.
- Avoid double-sending: the broadcast is triggered exactly once — when `approvalStatus` transitions to `"approved"`. If an event is updated while already `"approved"`, no email is sent.

### 9.5 Conflict notification email failures

- Wrap each `sendEventConflictNotificationEmail` call in a try/catch. A failed notification email must not prevent the event from being saved.
- Log failed notification emails with `[EVENTS]` prefix and the recipient email.

### 9.6 CopyFromPreviousEvent visibility

- Only shown in create mode (no `id` in `initialData`). Not shown in edit mode.
- Only shown to authenticated users (the component's API route requires auth anyway).
- If the user has no previous events, the select shows "No previous events found" (disabled placeholder item) and the component is effectively a no-op.

### 9.7 Shul dashboard authorization

- `POST /api/community/events` with a `shulId` body field: server must call `canUserManageShul(userId, shulId, userRole)` before inserting. Return 403 if not authorized.
- Admin users bypass this check.

### 9.8 Public form authentication

- `/community/calendar/new` renders on the server. Use `auth()` to check session.
- If no session: `redirect("/login?callbackUrl=/community/calendar/new")`.
- If session exists: render `PublicEventForm`.

### 9.9 Zod schema for public submission

Create `publicEventSchema` in `src/lib/validations/content.ts`:
- Same fields as `eventSchema` but omit `shulId` and `approvalStatus`.
- Add `flyerUrl`, `websiteUrl`, `organization`.
- `title` required. `startTime` required. `eventType` optional (default `"community"`).
- `forceSchedule` boolean (optional, default false) — validated but not stored in DB.

---

## 10. Migration Notes

### 10.1 Schema push

After updating `src/lib/db/schema.ts`:

```bash
npm run db:push
```

All three new columns (`flyerUrl`, `websiteUrl`, `organization`) are nullable — no data backfill needed.

### 10.2 Upload endpoint

Before wiring up the file inputs, verify `/api/upload` currently accepts PDFs. Check `src/app/api/upload/route.ts` for the allowed MIME type list. If `application/pdf` is not present, add it with a 10MB limit.

### 10.3 Existing `imageUrl` data

The `imageUrl` column already exists and may have `null` values for all events (since the form never surfaced it). No migration needed — the UI will now simply allow setting it going forward.

### 10.4 Resend batch API usage

The subscriber broadcast uses Resend's batch API (`resend.batch.send`). This is already used in the newsletter system. Use the same pattern from `src/app/api/cron/newsletter-send/route.ts` as reference for batching.

### 10.5 Vercel function timeout

The subscriber broadcast email is sent synchronously in the API response. For large subscriber lists (5k+), this could approach Vercel's function timeout. For v1, keep it synchronous but batch in groups of 100. If subscriber count grows significantly, move to a cron-based queue (same pattern as newsletters).

### 10.6 Testing checklist

Before deploying:

- [ ] Schema pushed, all three new columns visible in Drizzle Studio
- [ ] File upload works for both images and PDFs via `/api/upload`
- [ ] `EventForm` saves and retrieves `organization`, `websiteUrl`, `flyerUrl`
- [ ] `CopyFromPreviousEvent` pre-fills correct fields and leaves excluded fields blank
- [ ] Conflict modal appears when another approved event exists on the same date
- [ ] "Cancel" in conflict modal does not submit the event
- [ ] "Schedule Anyway" submits with `forceSchedule: true` and sends conflict emails
- [ ] Subscriber broadcast email sends when an event is approved (admin approve + auto-approve paths)
- [ ] No duplicate emails when re-saving an already-approved event
- [ ] `/community/calendar/new` redirects unauthenticated users to login
- [ ] Logged-in users can submit from `/community/calendar/new`
- [ ] Shul managers can create events from `/dashboard/shuls/[id]`
- [ ] Non-assigned shul managers receive 403 when trying to create event for another shul
- [ ] Homepage shows 6 events in 3-column grid with CTA row
