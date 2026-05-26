# Classifieds Enhancements Design Spec
**Date:** 2026-05-25  
**Status:** Ready for implementation

---

## 1. Overview

Two targeted enhancements to the classifieds system:

1. **Description character limit (2000 chars)** — Enforced at form, API, and database levels with a live counter.
2. **Anonymous email relay** — Replace the exposed `contactEmail` display on the public detail page with a "Contact Seller" modal. The system relays messages from interested buyers to the listing owner without ever exposing the owner's email address to the public. All contact attempts are logged to a new `classified_contact_log` table for admin abuse tracking.

No rate limiting is implemented. Abuse is handled through manual admin review of the contact log.

---

## 2. Database Schema Changes

### 2a. Modify `classifieds` table

**File:** `src/lib/db/schema.ts`

Change the `description` column from `text` to `varchar(2000)`:

```typescript
// BEFORE
description: text("description").notNull(),

// AFTER
description: varchar("description", { length: 2000 }).notNull(),
```

This enforces the limit at the database level as a hard backstop.

### 2b. New table: `classifiedContactLog`

Add after the `classifieds` table definition in `src/lib/db/schema.ts`:

```typescript
export const classifiedContactLog = pgTable("classified_contact_log", {
  id: serial("id").primaryKey(),
  classifiedId: integer("classified_id")
    .notNull()
    .references(() => classifieds.id, { onDelete: "cascade" }),
  senderName: varchar("sender_name", { length: 100 }).notNull(),
  senderEmail: varchar("sender_email", { length: 255 }).notNull(),
  message: text("message").notNull(),
  ipAddress: varchar("ip_address", { length: 50 }),
  sentAt: timestamp("sent_at").defaultNow(),
});
```

Add the export to the relations block — `classifieds` gets a `contactLogs: many(classifiedContactLog)` relation.

### 2c. Migration SQL

Run against the Neon database (use `npm run db:push` for dev, or apply manually):

```sql
-- Change description column to varchar(2000)
ALTER TABLE classifieds ALTER COLUMN description TYPE varchar(2000);

-- Create contact log table
CREATE TABLE classified_contact_log (
  id SERIAL PRIMARY KEY,
  classified_id INTEGER NOT NULL REFERENCES classifieds(id) ON DELETE CASCADE,
  sender_name VARCHAR(100) NOT NULL,
  sender_email VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  ip_address VARCHAR(50),
  sent_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_classified_contact_log_classified_id ON classified_contact_log(classified_id);
CREATE INDEX idx_classified_contact_log_sent_at ON classified_contact_log(sent_at DESC);
```

---

## 3. New Components

### 3a. `ContactSellerModal`

**File:** `src/components/classifieds/ContactSellerModal.tsx`

**Type:** Client component (`"use client"`)

**Props:**
```typescript
interface ContactSellerModalProps {
  classifiedId: number;
  classifiedTitle: string;
  hasContactEmail: boolean; // Controls whether button renders at all
}
```

**Behavior:**
- Renders nothing (returns `null`) if `hasContactEmail` is false
- Renders a "Contact Seller" Button (primary style) that opens a shadcn/ui `Dialog`
- Dialog title: "Contact Seller"
- Dialog description: "Send a message to the seller. Your contact information will be included so they can reply to you directly."

**Form fields inside dialog:**
| Field | Type | Pre-fill | Validation |
|-------|------|----------|------------|
| Your Name | Input | `session?.user?.name` if logged in | Required, max 100 chars |
| Your Email | Input (email) | `session?.user?.email` if logged in | Required, valid email, max 255 chars |
| Message | Textarea (rows=5) | — | Required, max 1000 chars, show live counter |

The message field shows a character counter below it: `"432 / 1,000"`. Counter text turns red when over limit.

**State:**
```typescript
const [isOpen, setIsOpen] = useState(false);
const [isSending, setIsSending] = useState(false);
const [form, setForm] = useState({ name: "", email: "", message: "" });
```

**On submit:**
1. Client-side validate all fields (show inline error messages, not toast)
2. `setIsSending(true)`
3. POST to `/api/classifieds/[classifiedId]/contact` with `{ senderName, senderEmail, message }`
4. On success: close dialog, reset form, show `toast.success("Your message has been sent to the seller.")`
5. On error: `toast.error(data.error || "Failed to send message")`, keep dialog open
6. Always: `setIsSending(false)`

**Uses:** `useSession` from `next-auth/react` to pre-fill name/email.

**Import pattern consistent with existing modals** (see `src/components/shiva/ShivaSubmitModal.tsx` and `src/components/kosher-alerts/KosherAlertSubmitModal.tsx` for reference).

---

## 4. Modified Components

### 4a. Public Classified Detail Page

**File:** `src/app/classifieds/[id]/page.tsx`

**Current state:** Server component. Shows `contactEmail` as a clickable `mailto:` link in the "Contact Information" card.

**Changes:**

1. **Remove** `contactEmail` from the `getClassified` SELECT query. Never fetch it from DB on the public page — this prevents it from appearing in server-rendered HTML or client-accessible props.

2. **Add** a boolean `hasContactEmail` field to the query instead:
   ```typescript
   hasContactEmail: sql<boolean>`(${classifieds.contactEmail} IS NOT NULL AND ${classifieds.contactEmail} != '')`.as("has_contact_email"),
   ```

3. **Remove** the `Mail` icon import and the email `<a>` element from the contact info card.

4. **Add** `ContactSellerModal` below the contact info card (or replace the email row with it):
   ```tsx
   <ContactSellerModal
     classifiedId={classified.id}
     classifiedTitle={classified.title}
     hasContactEmail={classified.hasContactEmail}
   />
   ```

5. The "Contact Information" card should still show `contactName` and `contactPhone` as before. Only `contactEmail` is hidden from the UI. If the listing has no name, phone, or email at all, hide the entire card.

**The detail page remains a server component.** `ContactSellerModal` is a client component imported into the server page — this is the same pattern used by `EventActions` on the event detail page (`src/app/(public)/community/calendar/[id]/page.tsx`).

### 4b. New Classified Submission Form

**File:** `src/app/classifieds/new/page.tsx`

**Changes to the description field:**

```tsx
// BEFORE
<Textarea
  id="description"
  value={form.description}
  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
  placeholder="Describe what you're selling, condition, etc."
  rows={5}
/>

// AFTER
<div>
  <Label htmlFor="description">
    Description <span className="text-red-500">*</span>
  </Label>
  <Textarea
    id="description"
    value={form.description}
    onChange={(e) => {
      const val = e.target.value;
      if (val.length <= 2000) {
        setForm((prev) => ({ ...prev, description: val }));
      }
    }}
    placeholder="Describe what you're selling, condition, etc."
    rows={5}
    maxLength={2000}
  />
  <p className={`text-xs mt-1 text-right ${form.description.length > 1900 ? "text-amber-600" : "text-gray-400"} ${form.description.length >= 2000 ? "text-red-600" : ""}`}>
    {form.description.length.toLocaleString()} / 2,000
  </p>
</div>
```

Color states for counter:
- Gray (< 1,900 chars): normal
- Amber (1,900–1,999): approaching limit
- Red (2,000): at limit

Also update the client-side validation in `handleSubmit` to add the limit check:
```typescript
if (form.description.trim().length > 2000) {
  toast.error("Description must be 2,000 characters or less");
  return;
}
```

### 4c. Admin Classifieds Edit Dialog

**File:** `src/app/(admin)/admin/programs/classifieds/page.tsx`

**Changes:**

1. Add character counter to the description Textarea in the edit dialog (same pattern as above — show `editForm.description.length / 2,000`).

2. Add "Contact Logs" section to the edit dialog. After the existing form fields and before the footer buttons, add:

```tsx
{/* Contact Logs */}
<div className="border-t pt-4">
  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
    <MessageSquare className="h-4 w-4" />
    Contact Log
    {contactLogs.length > 0 && (
      <Badge variant="secondary">{contactLogs.length}</Badge>
    )}
  </h3>
  {contactLogs.length === 0 ? (
    <p className="text-sm text-gray-400">No contact attempts yet.</p>
  ) : (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      {contactLogs.map((log) => (
        <div key={log.id} className="bg-gray-50 rounded p-3 text-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium">{log.senderName}</span>
            <span className="text-xs text-gray-400">
              {new Date(log.sentAt).toLocaleDateString()}
            </span>
          </div>
          <p className="text-gray-500 text-xs mb-1">{log.senderEmail}</p>
          <p className="text-gray-700 line-clamp-2">{log.message}</p>
        </div>
      ))}
    </div>
  )}
</div>
```

Add a `contactLogs` state array that is fetched from `GET /api/admin/classifieds/[id]/contact-log` when the edit dialog opens (`openEditDialog` function). Fetch it alongside the entry data.

Add `MessageSquare` to the lucide-react imports.

---

## 5. New API Routes

### 5a. POST `/api/classifieds/[id]/contact`

**File:** `src/app/api/classifieds/[id]/contact/route.ts`

**Auth:** Public endpoint (no auth required). IP address logged from request headers.

**Request body:**
```typescript
{
  senderName: string;   // required, max 100
  senderEmail: string;  // required, valid email, max 255
  message: string;      // required, max 1000
}
```

**Validation schema (Zod):**
```typescript
const contactSchema = z.object({
  senderName: z.string().min(1, "Name is required").max(100),
  senderEmail: z.string().email("Invalid email address").max(255),
  message: z.string().min(1, "Message is required").max(1000, "Message must be 1,000 characters or less"),
});
```

**Implementation steps:**

1. Parse and validate body with `contactSchema.safeParse`
2. Parse `[id]` param, validate it's a number
3. Fetch listing from DB — select only: `id`, `title`, `contactEmail`, `approvalStatus`, `isActive`
4. Return 404 if listing not found
5. Return 400 if listing is not approved or not active (listing text: "This listing is no longer available")
6. Return 400 if `contactEmail` is null or empty (listing has no email on file)
7. Get IP from `request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null`
8. Write to `classifiedContactLog`
9. Send relay email via Resend (see Section 8 for template)
10. Return `200 { success: true }` on success

**Error handling:** Wrap email send in try/catch. If email fails, log error but still return 200 (the log entry was saved). Do not fail the request due to email error.

**Response on success:** `{ success: true }`  
**Response on error:** `{ error: "Human readable message" }` with appropriate status code.

### 5b. GET `/api/admin/classifieds/[id]/contact-log`

**File:** `src/app/api/admin/classifieds/[id]/contact-log/route.ts`

**Auth:** Admin only (`session.user.role !== "admin"` → 401).

**Response:** Array of contact log entries ordered by `sentAt DESC`, most recent first. Returns last 50 entries maximum.

```typescript
// Response shape
[
  {
    id: number;
    senderName: string;
    senderEmail: string;
    message: string;
    ipAddress: string | null;
    sentAt: string; // ISO timestamp
  }
]
```

---

## 6. Modified API Routes

### 6a. `src/lib/validations/content.ts` — `classifiedSchema`

The `classifiedSchema` doesn't currently exist in this file (classifieds validation is inline in the API routes). Add it or update the description field in the community classifieds API:

**File:** `src/app/api/community/classifieds/route.ts`

Update the inline validation:
```typescript
// BEFORE
if (!description?.trim() || description.trim().length < 10) {
  return NextResponse.json(
    { error: "Description must be at least 10 characters" },
    { status: 400 }
  );
}

// AFTER
if (!description?.trim() || description.trim().length < 10) {
  return NextResponse.json(
    { error: "Description must be at least 10 characters" },
    { status: 400 }
  );
}
if (description.trim().length > 2000) {
  return NextResponse.json(
    { error: "Description must be 2,000 characters or less" },
    { status: 400 }
  );
}
```

### 6b. `src/app/api/admin/classifieds/[id]/route.ts` — `updateSchema`

Update the description field in `updateSchema`:
```typescript
// BEFORE
description: z.string().optional(),

// AFTER
description: z.string().max(2000, "Description must be 2,000 characters or less").optional(),
```

---

## 7. User Flow — Buyer Contacts Seller

1. Buyer views a classified listing at `/classifieds/[id]`
2. They see contact info: seller name and/or phone number (unchanged), but no email address
3. If the listing has a `contactEmail` in the DB, a "Contact Seller" button appears in the contact info card
4. Buyer clicks "Contact Seller" — a Dialog opens
5. If buyer is logged in: name and email fields are pre-filled from their session
6. Buyer types their message, sees live character counter under the textarea
7. Buyer clicks "Send Message"
8. Client POSTs to `/api/classifieds/[id]/contact`
9. Server validates, logs the attempt, sends relay email to seller's `contactEmail`
10. Dialog closes, buyer sees toast: "Your message has been sent to the seller."
11. Seller receives email from `noreply@frumtoronto.com` containing the buyer's name, email, and message, plus a link to the listing
12. Seller replies directly from their email client to the buyer's email address — normal email thread begins

---

## 8. Email Template

**Function name:** `getClassifiedContactEmailHtml`  
**File:** `src/lib/email/templates.ts` (add to existing file)

**Subject line:** `"Someone is interested in your listing: [listing title]"`

**Template:**
```typescript
export function getClassifiedContactEmailHtml(params: {
  listingTitle: string;
  listingUrl: string;
  senderName: string;
  senderEmail: string;
  message: string;
}): string {
  const { listingTitle, listingUrl, senderName, senderEmail, message } = params;
  const year = new Date().getFullYear();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background-color: #1e3a8a; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                Frum<span style="color: #60a5fa;">Toronto</span>
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 8px; color: #1e3a8a; font-size: 22px;">Someone is interested in your listing</h2>
              <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">
                Listing: <strong>${listingTitle}</strong>
              </p>

              <!-- Sender info box -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 4px; color: #374151; font-size: 14px;"><strong>From:</strong> ${senderName}</p>
                    <p style="margin: 0; color: #2563eb; font-size: 14px;"><strong>Email:</strong> <a href="mailto:${senderEmail}" style="color: #2563eb; text-decoration: none;">${senderEmail}</a></p>
                  </td>
                </tr>
              </table>

              <!-- Message -->
              <h3 style="margin: 0 0 12px; color: #374151; font-size: 16px;">Their message:</h3>
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-left: 4px solid #e5e7eb; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${message}</p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                To reply, simply respond to this email or email ${senderName} directly at <a href="mailto:${senderEmail}" style="color: #2563eb;">${senderEmail}</a>.
              </p>

              <!-- View listing button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="${listingUrl}" style="display: inline-block; background-color: #ea580c; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600;">
                      View Your Listing
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                This message was sent via FrumToronto Classifieds on behalf of ${senderName}.<br>
                &copy; ${year} FrumToronto. The Toronto Jewish Orthodox Community Gateway.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
```

**How it's called in the contact API route:**
```typescript
import { getClassifiedContactEmailHtml } from "@/lib/email/templates";
import { resend, EMAIL_FROM } from "@/lib/email/resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

await resend.emails.send({
  from: EMAIL_FROM,
  to: listing.contactEmail,
  subject: `Someone is interested in your listing: ${listing.title}`,
  html: getClassifiedContactEmailHtml({
    listingTitle: listing.title,
    listingUrl: `${APP_URL}/classifieds/${listing.id}`,
    senderName: validatedData.senderName,
    senderEmail: validatedData.senderEmail,
    message: validatedData.message,
  }),
});
```

---

## 9. Edge Cases and Validation

### No contact email on listing
- `ContactSellerModal` receives `hasContactEmail: false` → returns `null`, button never renders
- If somehow the contact API is called for a listing without an email, return `400 { error: "This listing does not have a contact email" }`

### Listing not approved / inactive
- API returns `400 { error: "This listing is no longer available" }`
- This handles deleted-but-not-purged listings gracefully

### Resend not initialized (missing API key)
- Check `if (!resend)` before sending, log error
- Still write to contact log, return 200 — the log exists for admin to follow up manually

### Empty message / whitespace-only message
- Zod `z.string().min(1)` catches this before DB write

### Message exactly at 1000 chars
- Valid. Counter shows "1,000 / 1,000" in red to signal they're at the limit, but submit is not blocked.

### Description exactly at 2000 chars
- Valid. Form allows submission at exactly 2000 chars.
- The `maxLength={2000}` on Textarea prevents typing beyond the limit at the browser level.
- API and DB enforce as a hard backstop.

### Description over 2000 chars in existing DB records
- `ALTER TABLE ... ALTER COLUMN` will fail if any existing row exceeds 2000 chars.
- Before running the migration, run: `SELECT id, length(description) FROM classifieds WHERE length(description) > 2000 ORDER BY length(description) DESC;`
- If any exist, truncate or handle them before migrating. See Migration Notes (Section 11).

### XSS in message body
- The email template uses template literal interpolation. Sanitize the message before inserting into HTML.
- Use a simple escape function or store raw and escape at render time.
- Add a helper to `templates.ts`:
  ```typescript
  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  }
  ```
  Apply to `senderName`, `senderEmail`, and `message` before interpolating into HTML.

---

## 10. Admin Experience

### Contact log in admin classifieds panel

When admin opens the edit dialog for any classified (`src/app/(admin)/admin/programs/classifieds/page.tsx`):

1. `openEditDialog(entry)` fires → also fetch `GET /api/admin/classifieds/${entry.id}/contact-log`
2. Store results in `contactLogs` state
3. At the bottom of the edit dialog (above footer buttons), render the contact log section
4. Shows: sender name, sender email, date sent, message preview (line-clamp-2)
5. If no logs: show "No contact attempts yet." in muted text

**No separate contact log page is needed** — embedding it in the edit dialog is sufficient for the expected volume.

### Admin edit dialog: description character counter

Same counter pattern as the submission form. Admin edit dialog's description Textarea gets:
- Live counter below: `{editForm.description.length.toLocaleString()} / 2,000`
- Color states: gray → amber at 1,900 → red at 2,000
- Zod `updateSchema` already validates max on the server side

---

## 11. Migration Notes

### Pre-migration check for long descriptions

Before altering the column, run this query to check for any existing rows that exceed 2000 chars:

```sql
SELECT id, title, length(description) AS desc_length
FROM classifieds
WHERE length(description) > 2000
ORDER BY desc_length DESC;
```

If rows exist, options:
1. Truncate to 2000 chars: `UPDATE classifieds SET description = left(description, 2000) WHERE length(description) > 2000;`
2. Or handle case-by-case in admin before migrating.

Run truncation before the `ALTER TABLE` command.

### Migration order

1. Check for long descriptions (query above)
2. Truncate if needed
3. `ALTER TABLE classifieds ALTER COLUMN description TYPE varchar(2000);`
4. `CREATE TABLE classified_contact_log ...`
5. Deploy code changes

### Schema push (dev)

For local dev, after editing `schema.ts`:
```bash
npm run db:push
```

This handles both the column type change and new table creation.

### No data loss risk for other columns

Only `description` column type changes. All other columns are untouched. The `contactEmail` column **remains in the database** — it is only hidden from the public UI. Admins still see and edit it in the admin panel. The relay system reads it server-side from the DB.

---

## 12. Files to Create

| File | Type |
|------|------|
| `src/components/classifieds/ContactSellerModal.tsx` | New client component |
| `src/app/api/classifieds/[id]/contact/route.ts` | New API route |
| `src/app/api/admin/classifieds/[id]/contact-log/route.ts` | New API route |

## 13. Files to Modify

| File | Change |
|------|--------|
| `src/lib/db/schema.ts` | Change `description` to `varchar(2000)`, add `classifiedContactLog` table |
| `src/lib/email/templates.ts` | Add `getClassifiedContactEmailHtml` function + `escapeHtml` helper |
| `src/app/classifieds/[id]/page.tsx` | Remove email display, add `hasContactEmail`, import `ContactSellerModal` |
| `src/app/classifieds/new/page.tsx` | Add description character counter, update validation |
| `src/app/(admin)/admin/programs/classifieds/page.tsx` | Add description counter to edit dialog, add contact log section |
| `src/app/api/community/classifieds/route.ts` | Add 2000 char limit check |
| `src/app/api/admin/classifieds/[id]/route.ts` | Add `.max(2000)` to `updateSchema` description field |
