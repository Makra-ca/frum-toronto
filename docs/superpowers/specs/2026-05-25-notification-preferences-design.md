# Notification Preferences System Overhaul
**Date:** 2026-05-25
**Status:** Ready for implementation

---

## 1. Overview

The current notification preferences system was built incrementally and has accumulated technical debt: column names are inconsistent (`shiva` vs `shivaNotifications`), the registration form presents a wall of ungrouped checkboxes, the dashboard settings page lists all preferences in a flat list with no context, and the public preferences page (`/newsletter/preferences`) is missing newer columns that were added directly to the database without being surfaced in any UI.

Additionally, four new preference types are being added to support automated transactional emails: question-answered notifications for Ask the Rabbi, comment reply notifications for ATR and blog posts, and business deal emails.

This spec covers:
- 4 new `emailSubscribers` columns
- Grouped checkbox UI on the registration page
- Updated dashboard settings page
- Updated public preferences page
- One-click per-type unsubscribe in all automated email footers
- Updated API routes for all modified surfaces

---

## 2. Database Schema Changes

### File: `src/lib/db/schema.ts`

Add 4 columns to the `emailSubscribers` table definition:

```typescript
askTheRabbiAnswered: boolean("ask_the_rabbi_answered").default(true).notNull(),
blogCommentNotifications: boolean("blog_comment_notifications").default(true).notNull(),
atrCommentReplies: boolean("atr_comment_replies").default(true).notNull(),
businessDeals: boolean("business_deals").default(false).notNull(),
```

### Migration SQL

```sql
ALTER TABLE email_subscribers
  ADD COLUMN IF NOT EXISTS ask_the_rabbi_answered  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS blog_comment_notifications BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS atr_comment_replies      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS business_deals           BOOLEAN NOT NULL DEFAULT false;
```

Run via: `npm run db:push` (dev) or apply as a migration in production.

### Existing Columns Retained As-Is

The following columns already exist and are not renamed:

| Column | DB Column |
|--------|-----------|
| newsletter | newsletter |
| kosherAlerts | kosher_alerts |
| simchas | simchas |
| shivaNotifications (stored as `shiva`) | shiva |
| tehillim | tehillim |
| communityEvents | community_events |
| communityAlerts | community_alerts |
| eruvStatus | eruv_status |

Note: the Drizzle schema uses `shiva` as the field name; treat this as `shivaNotifications` in all UI labels. Do not rename the column.

---

## 3. Complete Preference Matrix

| Column (Drizzle) | UI Label | Category | Default | Transactional? |
|-----------------|----------|----------|---------|---------------|
| `newsletter` | Weekly Newsletter | Torah Content | true | No (batch send) |
| `communityEvents` | Event Announcements | Community Updates | true | No (batch send) |
| `kosherAlerts` | Kosher Alerts | Community Updates | true | No (batch send) |
| `simchas` | Simchas | Community Updates | true | No (batch send) |
| `shiva` | Shiva Notices | Community Updates | true | No (batch send) |
| `tehillim` | Tehillim Requests | Community Updates | true | No (batch send) |
| `communityAlerts` | Community Alerts | Community Updates | true | No (batch send) |
| `askTheRabbiAnswered` | Ask the Rabbi — Answer Received | Torah Content | true | Yes |
| `atrCommentReplies` | Ask the Rabbi — Comment Replies | Torah Content | true | Yes |
| `blogCommentNotifications` | Blog Post Comments | Blog & Business | true | Yes |
| `businessDeals` | Business Deals & Specials | Blog & Business | false | Yes |

Transactional = sent to an individual user triggered by an action (not an admin batch send).

---

## 4. Registration Page Design

### File: `src/components/auth/RegisterForm.tsx`

Replace the current flat list of checkboxes with three labeled groups. Each group has a header label. Items within a group use standard checkboxes (not toggles — this is a registration form, not a settings page).

```
┌─────────────────────────────────────────────────────┐
│  Email Notifications                                 │
│  Choose what you'd like to hear about               │
│                                                     │
│  Community Updates                                  │
│  ┌────────────────────────────────────────────────┐ │
│  │ ☑  Event announcements                         │ │
│  │ ☑  Kosher alerts                               │ │
│  │ ☑  Simchas (births, engagements, weddings)     │ │
│  │ ☑  Shiva notices                               │ │
│  │ ☑  Tehillim requests                           │ │
│  │ ☑  Community alerts                            │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  Torah Content                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ ☑  Weekly newsletter                           │ │
│  │ ☑  Ask the Rabbi — when my question is answered│ │
│  │ ☑  Ask the Rabbi — comment replies             │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  Blog & Business                                    │
│  ┌────────────────────────────────────────────────┐ │
│  │ ☑  Blog post comments (on my posts)            │ │
│  │ ☐  Business deals & specials                   │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  ─────────────────────────────────────────────────  │
│  Member benefits                                    │
│    • Comment on Ask the Rabbi Q&A entries           │
│    • Submit classifieds and community events        │
│    • Manage notification preferences anytime        │
└─────────────────────────────────────────────────────┘
```

### Form Field Mapping

The `notifications` object in the register form schema (`src/lib/validations/auth.ts`) must be extended:

```typescript
notifications: z.object({
  newsletter: z.boolean().default(true),
  communityEvents: z.boolean().default(true),
  kosherAlerts: z.boolean().default(true),
  simchas: z.boolean().default(true),
  shiva: z.boolean().default(true),
  tehillim: z.boolean().default(true),
  communityAlerts: z.boolean().default(true),
  askTheRabbiAnswered: z.boolean().default(true),
  atrCommentReplies: z.boolean().default(true),
  blogCommentNotifications: z.boolean().default(true),
  businessDeals: z.boolean().default(false),
}).default({})
```

### Registration API

**File:** `src/app/api/auth/register/route.ts`

When creating the `emailSubscribers` record on registration, pass through all 11 preference values from `body.notifications`. The 4 new fields must be included in the `insert` call:

```typescript
askTheRabbiAnswered: notifications.askTheRabbiAnswered ?? true,
atrCommentReplies: notifications.atrCommentReplies ?? true,
blogCommentNotifications: notifications.blogCommentNotifications ?? true,
businessDeals: notifications.businessDeals ?? false,
```

---

## 5. Dashboard Settings Page

### File: `src/app/(dashboard)/dashboard/settings/page.tsx`

Add the 4 new preferences to the `notificationOptions` array. Keep the existing flat toggle list but add descriptive text for the new transactional types so users understand when they fire.

```typescript
// Add to notificationOptions array:
{
  id: "askTheRabbiAnswered" as const,
  label: "Ask the Rabbi — Answer Received",
  description: "Email me when a rabbi responds to my submitted question"
},
{
  id: "atrCommentReplies" as const,
  label: "Ask the Rabbi — Comment Replies",
  description: "Email me when someone replies to my comment on a Q&A"
},
{
  id: "blogCommentNotifications" as const,
  label: "Blog Post Comments",
  description: "Email me when someone comments on my blog post"
},
{
  id: "businessDeals" as const,
  label: "Business Deals & Specials",
  description: "Occasional emails about deals from FrumToronto directory businesses"
},
```

Update the `NotificationPreferences` interface to include all 11 fields. Update the defaults returned when no subscriber record exists to include the 4 new fields.

### Settings API

**File:** `src/app/api/user/notification-preferences/route.ts`

Add the 4 new fields to the `updateSchema` Zod object:

```typescript
askTheRabbiAnswered: z.boolean().optional(),
atrCommentReplies: z.boolean().optional(),
blogCommentNotifications: z.boolean().optional(),
businessDeals: z.boolean().optional(),
```

Add the 4 new fields to the `select` object in the GET handler and to the defaults returned when no record exists:

```typescript
// In GET - select block
askTheRabbiAnswered: emailSubscribers.askTheRabbiAnswered,
atrCommentReplies: emailSubscribers.atrCommentReplies,
blogCommentNotifications: emailSubscribers.blogCommentNotifications,
businessDeals: emailSubscribers.businessDeals,

// In GET - fallback defaults (no record)
askTheRabbiAnswered: true,
atrCommentReplies: true,
blogCommentNotifications: true,
businessDeals: false,
```

Add the 4 new fields to the `insert` values in the PATCH handler's else branch (create new record path):

```typescript
askTheRabbiAnswered: result.data.askTheRabbiAnswered ?? true,
atrCommentReplies: result.data.atrCommentReplies ?? true,
blogCommentNotifications: result.data.blogCommentNotifications ?? true,
businessDeals: result.data.businessDeals ?? false,
```

---

## 6. Public Preferences Page Updates

### File: `src/app/newsletter/preferences/page.tsx`

The public preferences page is accessed via token links in email footers. It currently handles 7 preferences. Add the 4 new ones.

**Update the `Preferences` interface:**

```typescript
interface Preferences {
  newsletter: boolean;
  kosherAlerts: boolean;
  eruvStatus: boolean;
  simchas: boolean;
  shiva: boolean;
  tehillim: boolean;
  communityEvents: boolean;
  // New:
  askTheRabbiAnswered: boolean;
  atrCommentReplies: boolean;
  blogCommentNotifications: boolean;
  businessDeals: boolean;
}
```

**Update initial state defaults:**

```typescript
const [preferences, setPreferences] = useState<Preferences>({
  // ... existing fields ...
  askTheRabbiAnswered: true,
  atrCommentReplies: true,
  blogCommentNotifications: true,
  businessDeals: false,
});
```

**Update the `SUBSCRIPTION_OPTIONS` array** — add grouped sections. Replace the flat array with grouped rendering. Present groups with a heading (`<h3>` or styled `<p>`) before each set:

Group: "Community Updates"
- newsletter, kosherAlerts, eruvStatus, simchas, shiva, tehillim, communityEvents

Group: "Torah Content"
- askTheRabbiAnswered, atrCommentReplies

Group: "Blog & Business"
- blogCommentNotifications, businessDeals

**Update the GET handler call** (`/api/newsletter/unsubscribe?token=...`) — the response from `GET /api/newsletter/unsubscribe` must also return the 4 new fields. See Section 9 (API Routes).

**Update the PUT body** to include all 11 fields when saving.

**Update the hasActiveSubscription check** in the PUT handler to include all 11 fields.

---

## 7. One-Click Unsubscribe Per Type

Every automated transactional email must include a one-click unsubscribe link in the footer that unsubscribes from only that specific notification type.

### URL Pattern

```
GET /api/newsletter/unsubscribe-type?token=[unsubscribeToken]&type=[columnName]
```

### New API Route

**File:** `src/app/api/newsletter/unsubscribe-type/route.ts` (new file)

**Behavior:**

1. Validate `token` and `type` params are present
2. Validate `type` is one of the allowed preference columns (allowlist — never pass raw column names to the DB)
3. Look up subscriber by token
4. Set that single column to `false`
5. Return an HTML confirmation page (or redirect to a confirmation page)

**Allowed types allowlist:**

```typescript
const ALLOWED_TYPES: Record<string, keyof typeof emailSubscribers> = {
  newsletter: "newsletter",
  kosherAlerts: "kosherAlerts",
  simchas: "simchas",
  shiva: "shiva",
  tehillim: "tehillim",
  communityEvents: "communityEvents",
  communityAlerts: "communityAlerts",
  eruvStatus: "eruvStatus",
  askTheRabbiAnswered: "askTheRabbiAnswered",
  atrCommentReplies: "atrCommentReplies",
  blogCommentNotifications: "blogCommentNotifications",
  businessDeals: "businessDeals",
};
```

**Response:** Redirect to `/newsletter/unsubscribed?type=[type]` with a confirmation message page.

### Confirmation Page

**File:** `src/app/newsletter/unsubscribed/page.tsx` (new file)

Displays:
- "You've been unsubscribed from [human-readable label]."
- Link: "Manage all email preferences" → `/newsletter/preferences?token=[token]`
- Link: "Return to FrumToronto" → `/`

The token and type are passed as query params so the page can generate the manage-all link.

### Human-Readable Labels for Confirmation

```typescript
const TYPE_LABELS: Record<string, string> = {
  newsletter: "the Weekly Newsletter",
  kosherAlerts: "Kosher Alerts",
  simchas: "Simcha announcements",
  shiva: "Shiva notices",
  tehillim: "Tehillim requests",
  communityEvents: "Event announcements",
  communityAlerts: "Community alerts",
  eruvStatus: "Eruv status updates",
  askTheRabbiAnswered: "Ask the Rabbi answer notifications",
  atrCommentReplies: "Ask the Rabbi comment reply notifications",
  blogCommentNotifications: "Blog comment notifications",
  businessDeals: "Business deals & specials",
};
```

---

## 8. Email Footer Requirements

All automated emails sent by the platform must include a footer with two links:

### Transactional Emails (ATR answered, blog comments, ATR comment replies, business deals)

```
Unsubscribe from [specific notification type]
https://frumtoronto.com/api/newsletter/unsubscribe-type?token=[unsubscribeToken]&type=[columnName]

Manage all email preferences
https://frumtoronto.com/newsletter/preferences?token=[unsubscribeToken]
```

The unsubscribe token comes from `emailSubscribers.unsubscribeToken` for the recipient. Look it up when sending any notification email using the recipient's `userId`.

### Batch/Community Emails (newsletter, kosher alerts, simchas, etc.)

These already have footer links. Ensure the format matches the above:
- "Unsubscribe from [type name]" — using the new per-type unsubscribe URL
- "Manage all preferences" — using the token-based preferences page URL

### Template Helper

**File:** `src/lib/email/templates.ts`

Add a shared footer HTML generator:

```typescript
export function buildEmailFooter(unsubscribeToken: string, typeKey: string, typeLabel: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://frumtoronto.com";
  return `
    <div style="...footer styles...">
      <a href="${baseUrl}/api/newsletter/unsubscribe-type?token=${unsubscribeToken}&type=${typeKey}">
        Unsubscribe from ${typeLabel}
      </a>
      &nbsp;|&nbsp;
      <a href="${baseUrl}/newsletter/preferences?token=${unsubscribeToken}">
        Manage all email preferences
      </a>
    </div>
  `;
}
```

---

## 9. New and Modified API Routes

### Modified: `GET /api/newsletter/unsubscribe`

**File:** `src/app/api/newsletter/unsubscribe/route.ts`

The GET handler's `select` block must return the 4 new columns so the preferences page can display them:

```typescript
// Add to select:
askTheRabbiAnswered: emailSubscribers.askTheRabbiAnswered,
atrCommentReplies: emailSubscribers.atrCommentReplies,
blogCommentNotifications: emailSubscribers.blogCommentNotifications,
businessDeals: emailSubscribers.businessDeals,
```

### Modified: `PUT /api/newsletter/unsubscribe`

**File:** `src/app/api/newsletter/unsubscribe/route.ts`

The PUT handler must accept and persist the 4 new fields in the `preferences` object:

```typescript
askTheRabbiAnswered: preferences.askTheRabbiAnswered ?? true,
atrCommentReplies: preferences.atrCommentReplies ?? true,
blogCommentNotifications: preferences.blogCommentNotifications ?? true,
businessDeals: preferences.businessDeals ?? false,
```

Update `hasActiveSubscription` to include all 11 fields (not just the original 7).

### Modified: `POST /api/newsletter/unsubscribe` (unsubscribe all)

The "unsubscribe all" POST handler currently sets a hardcoded list of columns to false. Add the 4 new columns:

```typescript
askTheRabbiAnswered: false,
atrCommentReplies: false,
blogCommentNotifications: false,
businessDeals: false,
```

### New: `GET /api/newsletter/unsubscribe-type`

**File:** `src/app/api/newsletter/unsubscribe-type/route.ts`

```
GET /api/newsletter/unsubscribe-type?token=[token]&type=[typeKey]
```

Behavior: validate token, validate type against allowlist, set single column to false, redirect to `/newsletter/unsubscribed?type=[typeKey]&token=[token]`.

Use `NextResponse.redirect()` for the response so users land on a confirmation page immediately.

### Modified: `PATCH /api/user/notification-preferences`

**File:** `src/app/api/user/notification-preferences/route.ts`

See Section 5. Add 4 new fields to schema, select, and insert.

---

## 10. Where Preferences Are Checked (Per Email Type)

Each email type must check the corresponding column before sending. The subscriber record is fetched by `userId` from `emailSubscribers`.

| Email Trigger | Column Checked | Where to Add Check |
|--------------|----------------|--------------------|
| Admin sends newsletter batch | `newsletter` | `src/app/api/cron/newsletter-send/route.ts` — already filters on `newsletter: true` |
| Admin sends event announcement | `communityEvents` | In the event notification send function |
| Admin sends kosher alert email | `kosherAlerts` | In the kosher alert notification send function |
| Admin sends simcha email | `simchas` | In the simcha notification send function |
| System sends shiva notice | `shiva` | In the shiva notification send function |
| System sends tehillim request | `tehillim` | In the tehillim notification send function |
| Admin sends community alert | `communityAlerts` | In the community alert send function |
| ATR question gets answered | `askTheRabbiAnswered` | In the ATR answer notification function (to be built) |
| Someone replies to ATR comment | `atrCommentReplies` | In the ATR comment reply notification function (to be built) |
| Someone comments on blog post | `blogCommentNotifications` | In `src/app/api/blog/[slug]/comments/route.ts` — when creating a comment, email the post author if their preference is enabled |
| Business posts a deal/special | `businessDeals` | In the deal notification send function (future) |

### Pattern for Checking a Preference Before Sending

```typescript
// Look up the recipient's emailSubscribers record before sending
const [subscriber] = await db
  .select({
    email: emailSubscribers.email,
    askTheRabbiAnswered: emailSubscribers.askTheRabbiAnswered,
    unsubscribeToken: emailSubscribers.unsubscribeToken,
  })
  .from(emailSubscribers)
  .where(eq(emailSubscribers.userId, recipientUserId))
  .limit(1);

if (!subscriber || !subscriber.askTheRabbiAnswered) {
  // User has opted out — skip sending
  return;
}

// Send email with unsubscribe footer
await sendEmail(subscriber.email, subject, html + buildEmailFooter(
  subscriber.unsubscribeToken,
  "askTheRabbiAnswered",
  "Ask the Rabbi answer notifications"
));
```

### Blog Comment Notification (Specific Case)

When a comment is posted on `/api/blog/[slug]/comments` (POST), check if the post author (not the commenter) has `blogCommentNotifications: true`, and if so, send them a notification email. Do not email the author if they are the one posting the comment.

---

## 11. Migration Notes

### Existing Subscribers

The 4 new columns have database-level defaults (`true` for ATR/blog/comment, `false` for businessDeals), so all existing `emailSubscribers` rows will automatically receive the correct default values when the migration runs.

No backfill script required.

### Schema Push

```bash
npm run db:push
```

This applies the 4 new columns with their defaults. Drizzle will generate the appropriate `ALTER TABLE` statements.

### Verification After Migration

```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE ask_the_rabbi_answered IS NULL) AS null_atr,
  COUNT(*) FILTER (WHERE blog_comment_notifications IS NULL) AS null_blog,
  COUNT(*) FILTER (WHERE atr_comment_replies IS NULL) AS null_atr_replies,
  COUNT(*) FILTER (WHERE business_deals IS NULL) AS null_deals
FROM email_subscribers;
```

All null counts should be 0 after migration (NOT NULL constraint with default).

---

## 12. File Change Summary

| File | Type of Change |
|------|---------------|
| `src/lib/db/schema.ts` | Add 4 columns to emailSubscribers |
| `src/lib/validations/auth.ts` | Add 4 fields to notifications Zod schema |
| `src/components/auth/RegisterForm.tsx` | Grouped checkbox UI + member benefits section |
| `src/app/api/auth/register/route.ts` | Pass 4 new fields when inserting emailSubscriber |
| `src/app/(dashboard)/dashboard/settings/page.tsx` | Add 4 new toggles to notificationOptions |
| `src/app/api/user/notification-preferences/route.ts` | Add 4 fields to schema, select, insert, defaults |
| `src/app/newsletter/preferences/page.tsx` | Add 4 new preferences, grouped display |
| `src/app/api/newsletter/unsubscribe/route.ts` | Add 4 fields to GET select, PUT update, POST unsubscribe-all |
| `src/app/api/newsletter/unsubscribe-type/route.ts` | NEW — per-type one-click unsubscribe |
| `src/app/newsletter/unsubscribed/page.tsx` | NEW — confirmation page |
| `src/lib/email/templates.ts` | Add buildEmailFooter() helper |
| `src/app/api/blog/[slug]/comments/route.ts` | Add blog comment author notification |
