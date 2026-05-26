# Permissions, Notifications & Audit Log System

**Date:** 2026-05-25
**Status:** Ready for implementation

---

## 1. Overview

Three interconnected systems that together give admins visibility and control over all platform activity:

1. **Permission Model** — A two-tier content submission model. Tier 1 users submit content to a pending queue. Tier 2 users (with `canAutoApprove*` flags) bypass the queue and post directly, but admins are still notified of every action.

2. **In-App Notifications** — A bell icon in the admin header and user dashboard header surfaces real-time notices: pending submissions, approval decisions, comments on posts, and answered questions. Notifications are retained for 30 days then auto-deleted.

3. **Audit Log** — An append-only log of every create, update, delete, approve, reject, publish, and login action across the entire platform. Admin-only, read-only from the UI.

---

## 2. Permission Model

### Two-Tier Content Submission

Every content type (events, blog, businesses, classifieds, shuls, shiurim, simchas, shiva, tehillim, kosher alerts, ask the rabbi) follows this model:

**Tier 1 — Default (pending queue):**
- User submits content
- `approvalStatus` is set to `'pending'`
- Content is not visible publicly
- Admin receives a `content_submitted` notification
- Admin approves or rejects from `/admin/approvals`
- User receives a `content_approved` or `content_rejected` notification

**Tier 2 — Trusted (auto-approved):**
- User has the relevant `canAutoApprove[ContentType]` flag set to `true` on their user record
- `approvalStatus` is set to `'approved'` immediately on submission
- Content is visible publicly right away
- Admin receives a `trusted_user_posted` notification (informational, no action needed)
- User does NOT receive a separate approval notification (they see the content live)

### New Permission Flags

Two additional columns are added to the `users` table beyond the existing `canAutoApprove*` flags:

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `canManageAskTheRabbi` | boolean | false | Grants access to a management UI in the user dashboard for ATR questions — can publish answers, edit questions — without being full admin |
| `commentPermission` | varchar(20) | 'allowed' | Controls comment behavior for this user: `'allowed'` (comments post per the post's moderation setting), `'moderated'` (all comments by this user always go to pending regardless of post setting), `'blocked'` (user cannot post comments at all) |

### Existing Flags (reference)

Already in schema, no changes needed:

```
canAutoApproveShiva, canAutoApproveTehillim, canAutoApproveBusinesses,
canAutoApproveAskTheRabbi, canAutoApproveKosherAlerts, canAutoApproveShuls,
canAutoApproveSimchas, canAutoApproveEvents, canAutoApproveClassifieds,
canAutoApproveShiurim, canAutoApproveAlerts, canAutoApproveBlog
```

---

## 3. Database Schema Changes

### 3.1 New Columns on `users` Table

```sql
ALTER TABLE users
  ADD COLUMN can_manage_ask_the_rabbi BOOLEAN DEFAULT false,
  ADD COLUMN comment_permission VARCHAR(20) DEFAULT 'allowed';
```

In `src/lib/db/schema.ts`, add to the `users` pgTable definition:

```typescript
canManageAskTheRabbi: boolean("can_manage_ask_the_rabbi").default(false),
commentPermission: varchar("comment_permission", { length: 20 }).default("allowed"),
// allowed | moderated | blocked
```

### 3.2 New Table: `notifications`

```sql
CREATE TABLE notifications (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            VARCHAR(50) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  body            TEXT,
  link            VARCHAR(500),
  is_read         BOOLEAN DEFAULT false,
  entity_type     VARCHAR(50),
  entity_id       INTEGER,
  created_at      TIMESTAMP DEFAULT now()
);

CREATE INDEX notifications_user_id_is_read ON notifications(user_id, is_read);
CREATE INDEX notifications_created_at ON notifications(created_at);
```

In `src/lib/db/schema.ts`:

```typescript
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  link: varchar("link", { length: 500 }),
  isRead: boolean("is_read").default(false),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: integer("entity_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("notifications_user_id_is_read").on(table.userId, table.isRead),
  index("notifications_created_at").on(table.createdAt),
]);
```

### 3.3 New Table: `audit_log`

```sql
CREATE TABLE audit_log (
  id              SERIAL PRIMARY KEY,
  actor_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_email     VARCHAR(255) NOT NULL,
  action          VARCHAR(50) NOT NULL,
  entity_type     VARCHAR(50) NOT NULL,
  entity_id       INTEGER,
  entity_title    VARCHAR(255),
  changes         JSONB,
  ip_address      VARCHAR(50),
  created_at      TIMESTAMP DEFAULT now()
);

CREATE INDEX audit_log_actor_id ON audit_log(actor_id);
CREATE INDEX audit_log_entity_type ON audit_log(entity_type);
CREATE INDEX audit_log_action ON audit_log(action);
CREATE INDEX audit_log_created_at ON audit_log(created_at DESC);
```

In `src/lib/db/schema.ts`:

```typescript
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
  actorEmail: varchar("actor_email", { length: 255 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  // CREATE | UPDATE | DELETE | APPROVE | REJECT | PUBLISH | LOGIN
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: integer("entity_id"),
  entityTitle: varchar("entity_title", { length: 255 }),
  changes: jsonb("changes"),
  // For UPDATE: { fieldName: { before: oldValue, after: newValue }, ... }
  ipAddress: varchar("ip_address", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("audit_log_actor_id").on(table.actorId),
  index("audit_log_entity_type").on(table.entityType),
  index("audit_log_action").on(table.action),
  index("audit_log_created_at").on(table.createdAt),
]);
```

---

## 4. Notification System Architecture

### Creating a Notification

All notification creation goes through a single helper function (see Section 12). API routes call the helper after successfully writing data to the database.

### Delivery

Notifications are in-app only — no email is sent for notifications (newsletters handle email communication separately).

### Reading / Marking as Read

- Notifications are marked as read individually when the user clicks them (navigates to the `link` URL).
- A "Mark all as read" button marks all of a user's notifications as read in one API call.
- Unread count is fetched on every page load via a lightweight API call and cached in React state.

### Retention / Cleanup

Notifications older than 30 days are automatically deleted. Two approaches (pick one during implementation):

**Option A — Cron job (preferred if vercel.json already has cron):**
Add to `vercel.json`:
```json
{
  "path": "/api/cron/cleanup-notifications",
  "schedule": "0 3 * * *"
}
```
Route: `src/app/api/cron/cleanup-notifications/route.ts`
```typescript
DELETE FROM notifications WHERE created_at < now() - interval '30 days';
```

**Option B — Clean on read:**
When fetching notifications for a user, also run a delete for expired records in the same request. Slightly less clean but avoids adding a cron.

---

## 5. Notification Types Reference

| type | Sent to | Trigger | link example |
|------|---------|---------|--------------|
| `content_submitted` | All admin users | Any Tier 1 submission (pending approval) | `/admin/approvals` |
| `trusted_user_posted` | All admin users | Tier 2 user submits and auto-approves | `/admin/programs/blog` (varies by entity type) |
| `content_approved` | Content creator | Admin approves their submission | `/blog/my-post-slug` (varies) |
| `content_rejected` | Content creator | Admin rejects their submission | `/dashboard/blog` (varies) |
| `comment_posted` | Blog post author | Someone comments on their post | `/blog/[slug]#comments` |
| `question_answered` | ATR question submitter | Admin publishes an answer | `/ask-the-rabbi/[questionNumber]` |
| `nonprofit_application` | All admin users | Non-profit business plan application submitted | `/admin/businesses` |
| `video_pending` | All admin users | Business uploads a video pending review | `/admin/businesses` |

### Link Routing by Entity Type (for `content_submitted` / `trusted_user_posted`)

| entityType | Admin link |
|------------|------------|
| `blog_post` | `/admin/programs/blog` |
| `event` | `/admin/programs` |
| `classified` | `/admin/programs` |
| `business` | `/admin/businesses` |
| `shul` | `/admin/shuls` |
| `shiur` | `/admin/programs` |
| `simcha` | `/admin/community/simchas` |
| `shiva` | `/admin/community/shiva` |
| `tehillim` | `/admin/community/tehillim` |
| `kosher_alert` | `/admin/community/kosher-alerts` |
| `ask_the_rabbi` | `/admin/programs` |

### Sending to All Admins

For admin-targeted notifications, query all users where `role = 'admin'` and `isActive = true`, then insert one notification row per admin.

```typescript
const adminUsers = await db
  .select({ id: users.id })
  .from(users)
  .where(and(eq(users.role, "admin"), eq(users.isActive, true)));

await db.insert(notifications).values(
  adminUsers.map((admin) => ({
    userId: admin.id,
    type,
    title,
    body,
    link,
    entityType,
    entityId,
  }))
);
```

---

## 6. Audit Log Architecture

### What Gets Logged

Every state-changing action across the platform:

| Action | Examples |
|--------|---------|
| `CREATE` | New business, event, blog post, user, shul, shiur, classified |
| `UPDATE` | Edit any entity — include changed fields in `changes` JSONB |
| `DELETE` | Delete any entity |
| `APPROVE` | Admin approves pending content |
| `REJECT` | Admin rejects pending content |
| `PUBLISH` | Blog post published, ATR answer published |
| `LOGIN` | Successful user login (from NextAuth callbacks) |

### Changes JSONB Format

For UPDATE actions, record only fields that actually changed:

```json
{
  "name": { "before": "Old Business Name", "after": "New Business Name" },
  "isActive": { "before": true, "after": false }
}
```

Do not log password hashes. Do not log fields that didn't change.

### IP Address Extraction

```typescript
function getIpAddress(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
```

### Retention

Audit log has no automatic deletion — it is permanent by design for compliance and accountability. The admin UI paginates and filters to keep it usable.

---

## 7. New Components

### 7.1 `NotificationBell` (shared)

**File:** `src/components/notifications/NotificationBell.tsx`

Client component. Renders a bell icon button with an unread count badge. On click, navigates to the notifications page (admin or dashboard depending on context).

Props:
```typescript
interface NotificationBellProps {
  href: string; // '/admin/notifications' or '/dashboard/notifications'
}
```

Behavior:
- Fetches unread count from `/api/notifications/unread-count` on mount and every 60 seconds
- Shows red badge with count when unread > 0
- Badge shows "9+" when count > 9

### 7.2 `NotificationList` (shared)

**File:** `src/components/notifications/NotificationList.tsx`

Client component. Renders the full list of notifications with:
- Each row: icon by type, title, body excerpt, relative timestamp (e.g. "2 hours ago"), unread dot
- Click row: marks as read via API, then navigates to `link`
- "Mark all as read" button at top right
- Empty state: "No notifications"
- Pagination or infinite scroll (start with pagination, 25 per page)

### 7.3 `AuditLogTable`

**File:** `src/components/admin/AuditLogTable.tsx`

Client component. Renders the audit log with:
- Columns: Date/Time, Actor, Action (colored badge), Entity Type, Entity, IP Address
- Expandable row: shows `changes` JSONB diff when action is UPDATE
- Filter bar: entity type select, action select, actor search, date range (start/end)
- Pagination (50 rows per page)

---

## 8. New API Routes

### 8.1 Notifications

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/notifications` | GET | Self | List notifications for current user (paginated, ?page=1&limit=25) |
| `/api/notifications/unread-count` | GET | Self | Returns `{ count: number }` — lightweight poll |
| `/api/notifications/[id]/read` | PATCH | Self | Mark single notification as read |
| `/api/notifications/read-all` | PATCH | Self | Mark all notifications as read for current user |

**File locations:**
- `src/app/api/notifications/route.ts`
- `src/app/api/notifications/unread-count/route.ts`
- `src/app/api/notifications/[id]/read/route.ts`
- `src/app/api/notifications/read-all/route.ts`

All routes require the user to be authenticated. Users can only access their own notifications (filter by `userId = session.user.id`).

### 8.2 Audit Log

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/admin/audit-log` | GET | Admin only | List audit log entries with filters |

**File:** `src/app/api/admin/audit-log/route.ts`

Query params:
- `page` (default 1)
- `limit` (default 50)
- `entityType` (filter)
- `action` (filter)
- `actorId` (filter)
- `dateFrom` (ISO date string)
- `dateTo` (ISO date string)

### 8.3 Cron: Cleanup Notifications

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/cron/cleanup-notifications` | GET | CRON_SECRET header | Delete notifications older than 30 days |

**File:** `src/app/api/cron/cleanup-notifications/route.ts`

Protect with: `request.headers.get("authorization") !== Bearer ${process.env.CRON_SECRET}` → 401.

---

## 9. Modified API Routes (Add Audit Logging)

Every API route that creates, updates, deletes, approves, or rejects data needs a `logAudit()` call added after the DB write succeeds. Below is the full list of route files to update:

### Businesses
- `src/app/api/admin/businesses/route.ts` — CREATE
- `src/app/api/admin/businesses/[id]/route.ts` — UPDATE, DELETE, APPROVE, REJECT

### Events
- `src/app/api/admin/events/route.ts` — CREATE
- `src/app/api/admin/events/[id]/route.ts` — UPDATE, DELETE, APPROVE, REJECT

### Shuls
- `src/app/api/admin/shuls/route.ts` — CREATE
- `src/app/api/admin/shuls/[id]/route.ts` — UPDATE, DELETE, APPROVE, REJECT

### Shiurim
- `src/app/api/admin/shiurim/route.ts` — CREATE
- `src/app/api/admin/shiurim/[id]/route.ts` — UPDATE, DELETE

### Blog
- `src/app/api/admin/blog/route.ts` — CREATE
- `src/app/api/admin/blog/[id]/route.ts` — UPDATE, DELETE, APPROVE, REJECT, PUBLISH
- `src/app/api/admin/blog/comments/[id]/route.ts` — APPROVE, REJECT, DELETE
- `src/app/api/user/blog/route.ts` — CREATE
- `src/app/api/user/blog/[id]/route.ts` — UPDATE, DELETE

### Classifieds
- `src/app/api/admin/classifieds/[id]/route.ts` — UPDATE, DELETE, APPROVE, REJECT

### Community Content
- `src/app/api/admin/shiva/[id]/route.ts` — UPDATE, DELETE, APPROVE, REJECT
- `src/app/api/admin/kosher-alerts/[id]/route.ts` — UPDATE, DELETE, APPROVE, REJECT
- `src/app/api/admin/alerts/[id]/route.ts` — UPDATE, DELETE
- `src/app/api/admin/alerts/route.ts` — CREATE
- `src/app/api/community/shiva/route.ts` — CREATE (user submission)
- `src/app/api/community/kosher-alerts/route.ts` — CREATE (user submission)

### Users
- `src/app/api/admin/users/route.ts` — CREATE
- `src/app/api/admin/users/[id]/route.ts` — UPDATE, DELETE

### Ask the Rabbi
- Any admin route that publishes/answers questions — PUBLISH, UPDATE, DELETE

### Auth (LOGIN)
Add audit logging to NextAuth callbacks in `src/lib/auth/auth.ts`:
```typescript
// In the signIn callback or jwt callback on first login
// Log: action: "LOGIN", entityType: "user", entityId: user.id, entityTitle: user.email
// IP address not available in NextAuth callbacks — log as "unknown"
```

---

## 10. Admin UI

### 10.1 Notifications Page: `/admin/notifications`

**File:** `src/app/(admin)/admin/notifications/page.tsx`

- Server component wrapper that renders `<NotificationList />` client component
- Title: "Notifications"
- Shows all notifications for the current admin user
- Mark all as read button
- Each notification links to its relevant admin page

### 10.2 Bell Icon in Admin Header

**File to modify:** `src/components/admin/AdminLayoutClient.tsx`

Add `<NotificationBell href="/admin/notifications" />` to the admin header area (top right, next to existing controls). The unread count badge should be visible on all admin pages.

### 10.3 Audit Log Page: `/admin/audit-log`

**File:** `src/app/(admin)/admin/audit-log/page.tsx`

- Server component wrapper, renders `<AuditLogTable />` client component
- Title: "Audit Log"
- Read-only table with filtering and pagination
- No delete or edit actions

### 10.4 Admin Sidebar Link

**File to modify:** `src/components/admin/AdminLayoutClient.tsx`

Add "Audit Log" as a link in the admin sidebar. Suggested placement: below "Settings", above or near the bottom of the nav.

Also ensure "Notifications" is accessible from the bell icon click (no separate sidebar link needed — the bell navigates directly).

### 10.5 User Permissions Dialog Update

**File to modify:** `src/app/(admin)/admin/users/page.tsx` (and `UserTable.tsx` if separate)

The existing permissions dialog (opened via shield icon) should be extended to show and toggle:
- `canManageAskTheRabbi` (new)
- `commentPermission` — rendered as a select/radio: Allowed / Moderated / Blocked (new)

All existing `canAutoApprove*` toggles remain as-is.

---

## 11. User Dashboard UI

### 11.1 Notifications Page: `/dashboard/notifications`

**File:** `src/app/(dashboard)/dashboard/notifications/page.tsx`

- Server component wrapper, renders `<NotificationList />` client component
- Shows only notifications targeting the current user (their content approvals, comments on their posts, answered questions)

### 11.2 Bell Icon in Dashboard Header

The dashboard currently does not have a persistent header with a bell. Options:

**Option A (preferred):** Add a lightweight top bar or notification area to the dashboard layout that shows the bell icon.

**File to modify:** `src/app/(dashboard)/dashboard/layout.tsx` (or equivalent dashboard layout component)

Add `<NotificationBell href="/dashboard/notifications" />` in the dashboard page header area.

**Option B:** Add the bell icon to the main site `<Header />` component, visible to all logged-in users. This surfaces it across the whole site, not just the dashboard.

Implement whichever fits the dashboard layout better — confirm with Daniel before implementing.

---

## 12. Helper Functions

### 12.1 `createNotification()` — `src/lib/notifications.ts`

```typescript
import { db } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

interface NotificationPayload {
  userId: number;
  type: string;
  title: string;
  body?: string;
  link?: string;
  entityType?: string;
  entityId?: number;
}

export async function createNotification(payload: NotificationPayload): Promise<void> {
  await db.insert(notifications).values(payload);
}

export async function createAdminNotification(
  payload: Omit<NotificationPayload, "userId">
): Promise<void> {
  const adminUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true)));

  if (adminUsers.length === 0) return;

  await db.insert(notifications).values(
    adminUsers.map((admin) => ({ ...payload, userId: admin.id }))
  );
}
```

**Usage in API routes:**

```typescript
import { createNotification, createAdminNotification } from "@/lib/notifications";

// Tier 1 submission — notify all admins
await createAdminNotification({
  type: "content_submitted",
  title: "New blog post pending approval",
  body: `"${post.title}" submitted by ${session.user.name}`,
  link: "/admin/programs/blog",
  entityType: "blog_post",
  entityId: newPost.id,
});

// Tier 2 (auto-approved) — notify all admins
await createAdminNotification({
  type: "trusted_user_posted",
  title: "Trusted user posted a blog post",
  body: `"${post.title}" by ${session.user.name} (auto-approved)`,
  link: "/admin/programs/blog",
  entityType: "blog_post",
  entityId: newPost.id,
});

// User notification — content approved
await createNotification({
  userId: post.authorId,
  type: "content_approved",
  title: "Your blog post was approved",
  body: `"${post.title}" is now published`,
  link: `/blog/${post.slug}`,
  entityType: "blog_post",
  entityId: post.id,
});
```

### 12.2 `logAudit()` — `src/lib/audit.ts`

```typescript
import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

interface AuditPayload {
  actorId: number;
  actorEmail: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "REJECT" | "PUBLISH" | "LOGIN";
  entityType: string;
  entityId?: number | null;
  entityTitle?: string | null;
  changes?: Record<string, { before: unknown; after: unknown }> | null;
  ipAddress?: string | null;
}

export async function logAudit(payload: AuditPayload): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorId: payload.actorId,
      actorEmail: payload.actorEmail,
      action: payload.action,
      entityType: payload.entityType,
      entityId: payload.entityId ?? null,
      entityTitle: payload.entityTitle ?? null,
      changes: payload.changes ?? null,
      ipAddress: payload.ipAddress ?? null,
    });
  } catch (error) {
    // Never let audit logging fail an API request
    console.error("[AUDIT] Failed to write audit log entry:", error);
  }
}
```

**Helper to extract IP from NextRequest:**

```typescript
export function getIpFromRequest(request: Request | NextRequest): string {
  const forwarded = (request as NextRequest).headers?.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
```

**Usage in API routes:**

```typescript
import { logAudit, getIpFromRequest } from "@/lib/audit";

// After successful create
await logAudit({
  actorId: session.user.id,
  actorEmail: session.user.email,
  action: "CREATE",
  entityType: "business",
  entityId: newBusiness.id,
  entityTitle: newBusiness.name,
  ipAddress: getIpFromRequest(request),
});

// After successful update (compute diff first)
const changes: Record<string, { before: unknown; after: unknown }> = {};
if (body.name !== existing.name) {
  changes.name = { before: existing.name, after: body.name };
}
// ... other fields
if (Object.keys(changes).length > 0) {
  await logAudit({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "UPDATE",
    entityType: "business",
    entityId: existing.id,
    entityTitle: existing.name,
    changes,
    ipAddress: getIpFromRequest(request),
  });
}

// Approve
await logAudit({
  actorId: session.user.id,
  actorEmail: session.user.email,
  action: "APPROVE",
  entityType: "blog_post",
  entityId: post.id,
  entityTitle: post.title,
  ipAddress: getIpFromRequest(request),
});
```

---

## 13. Client-Facing Note (30-Day Retention)

Include the following as inline documentation anywhere admin-facing notification UX is displayed, and in the admin notifications page:

> Notifications are retained for 30 days. Older notifications are automatically removed. Check this page regularly for pending approvals and trusted user activity.

This should appear as a subtle subtitle or info banner on `/admin/notifications`.

---

## 14. Migration Notes

### Schema Migration Strategy

This project uses `npm run db:push` for development schema changes (no migration files). For production, generate migration files with `npm run db:generate` then run `npm run db:migrate`.

**Step 1: Add new columns to `users`**
```typescript
// In schema.ts — add to users table:
canManageAskTheRabbi: boolean("can_manage_ask_the_rabbi").default(false),
commentPermission: varchar("comment_permission", { length: 20 }).default("allowed"),
```

**Step 2: Add `notifications` table**
Add the full `notifications` pgTable definition (see Section 3.2).

**Step 3: Add `audit_log` table**
Add the full `auditLog` pgTable definition (see Section 3.3).

**Step 4: Push schema**
```bash
npm run db:push
```

**Step 5: Create helper files**
- `src/lib/notifications.ts`
- `src/lib/audit.ts`

**Step 6: Build new API routes**
Notifications API (Section 8.1), audit log API (Section 8.2), cron cleanup (Section 8.3).

**Step 7: Build new components**
`NotificationBell`, `NotificationList`, `AuditLogTable` (Section 7).

**Step 8: Update existing API routes**
Add `logAudit()` and `createNotification()` / `createAdminNotification()` calls throughout (Section 9). This is the highest-effort step — work through entity types one at a time.

**Step 9: Update admin layout**
Add bell icon to `AdminLayoutClient.tsx`, add sidebar link for Audit Log.

**Step 10: Update admin users permissions dialog**
Add `canManageAskTheRabbi` toggle and `commentPermission` select to the shield icon dialog.

**Step 11: Add cron to vercel.json**
```json
{
  "path": "/api/cron/cleanup-notifications",
  "schedule": "0 3 * * *"
}
```

### Backwards Compatibility

- New `users` columns have safe defaults (`false` / `'allowed'`) — no existing behavior changes.
- `notifications` and `audit_log` are new tables — no existing queries affected.
- `logAudit()` wraps failures in try/catch — audit failures never break existing API routes.
- `createNotification()` and `createAdminNotification()` should also be wrapped in try/catch in API routes so a notification failure does not roll back a successful content submission.
