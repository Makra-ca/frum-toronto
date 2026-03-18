# Simchas & Alerts User Submission System

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-facing submit modals for Simchas and Community Alerts, matching the existing KosherAlertSubmitModal pattern, with photo upload for simchas and approval workflow for both.

**Architecture:** Create two new client-side modal components (SimchaSubmitModal, AlertSubmitModal) with corresponding public POST API endpoints. Add `approvalStatus` column to the alerts table and `canAutoApproveAlerts` permission to users. Seed simcha types. Fix the Community Corner "Share a Simcha" link to go to `/simchas`. Both simchas and alerts pages become hybrid (server page + client modal in header).

**Tech Stack:** Next.js App Router, Drizzle ORM, Vercel Blob (photo upload), shadcn/ui Dialog, react-hook-form not needed (simple useState pattern matching KosherAlertSubmitModal), Sonner toasts.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/db/schema.ts` | Modify | Add `approvalStatus` to alerts table, add `canAutoApproveAlerts` to users |
| `src/components/simchas/SimchaSubmitModal.tsx` | Create | Client modal: auth check, type dropdown, photo upload with preview, form submission |
| `src/components/alerts/AlertSubmitModal.tsx` | Create | Client modal: auth check, alert type/urgency dropdowns, form submission |
| `src/app/api/community/simchas/route.ts` | Create | GET (public list) + POST (user submission with auto-approve check) |
| `src/app/api/community/alerts/route.ts` | Create | POST (user submission with auto-approve check) |
| `src/app/api/simcha-types/route.ts` | Create | GET public endpoint for simcha types dropdown |
| `src/app/(public)/simchas/page.tsx` | Modify | Add SimchaSubmitModal to header, add approval filter to query |
| `src/app/(public)/alerts/page.tsx` | Modify | Add AlertSubmitModal to header, add approval filter to query |
| `src/components/home/CommunityCornerTabs.tsx` | Modify | Fix "Share a Simcha" link from `/simchas/new` to `/simchas` |

---

## Task 1: Database Schema Changes

**Files:**
- Modify: `src/lib/db/schema.ts` (lines 519-530 for alerts, line ~45 for users)

- [ ] **Step 1: Add `approvalStatus` to alerts table**

In `src/lib/db/schema.ts`, add to the alerts table definition:

```typescript
approvalStatus: varchar("approval_status", { length: 20 }).default("approved"),
```

Default is `"approved"` so existing admin-created alerts are unaffected. User submissions will explicitly set `"pending"`.

- [ ] **Step 2: Add `canAutoApproveAlerts` to users table**

In `src/lib/db/schema.ts`, add after the existing `canAutoApproveClassifieds` line:

```typescript
canAutoApproveAlerts: boolean("can_auto_approve_alerts").default(false),
```

- [ ] **Step 3: Push schema changes**

Run: `npm run db:push`

- [ ] **Step 4: Seed simcha types**

Run this SQL in Neon console:

```sql
INSERT INTO simcha_types (name, slug, display_order) VALUES
('Birth', 'birth', 1),
('Engagement', 'engagement', 2),
('Wedding', 'wedding', 3),
('Bar Mitzvah', 'bar-mitzvah', 4),
('Bat Mitzvah', 'bat-mitzvah', 5),
('Anniversary', 'anniversary', 6),
('Other', 'other', 7);
```

- [ ] **Step 5: Update alerts query on public page to filter by approvalStatus**

In `src/app/(public)/alerts/page.tsx`, update `getAlerts()` query to also filter:

```typescript
eq(alerts.approvalStatus, "approved"),
```

Add it to the existing `and(...)` conditions.

- [ ] **Step 6: Update alerts query on simchas page to filter by approvalStatus**

In `src/app/(public)/simchas/page.tsx`, update `getSimchas()` to also filter:

```typescript
eq(simchas.approvalStatus, "approved"),
```

Add to existing `.where()`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/schema.ts src/app/(public)/alerts/page.tsx src/app/(public)/simchas/page.tsx
git commit -m "feat: add approvalStatus to alerts, canAutoApproveAlerts permission, filter public pages"
```

---

## Task 2: Public API Endpoints

**Files:**
- Create: `src/app/api/simcha-types/route.ts`
- Create: `src/app/api/community/simchas/route.ts`
- Create: `src/app/api/community/alerts/route.ts`

- [ ] **Step 1: Create public simcha types endpoint**

Create `src/app/api/simcha-types/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { simchaTypes } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const types = await db
      .select()
      .from(simchaTypes)
      .orderBy(simchaTypes.displayOrder);

    return NextResponse.json(types);
  } catch (error) {
    console.error("[API] Error fetching simcha types:", error);
    return NextResponse.json({ error: "Failed to fetch types" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create community simchas POST endpoint**

Create `src/app/api/community/simchas/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { simchas, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { familyName, announcement, typeId, eventDate, location, photoUrl } = body;

    if (!familyName?.trim()) {
      return NextResponse.json({ error: "Family name is required" }, { status: 400 });
    }
    if (!announcement?.trim() || announcement.length < 10) {
      return NextResponse.json({ error: "Announcement must be at least 10 characters" }, { status: 400 });
    }

    // Check auto-approve permission
    const userId = parseInt(session.user.id);
    const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const autoApprove = dbUser?.canAutoApproveSimchas || session.user.role === "admin";

    const [created] = await db
      .insert(simchas)
      .values({
        userId,
        familyName: familyName.trim(),
        announcement: announcement.trim(),
        typeId: typeId ? parseInt(typeId) : null,
        eventDate: eventDate || null,
        location: location?.trim() || null,
        photoUrl: photoUrl || null,
        approvalStatus: autoApprove ? "approved" : "pending",
        isActive: true,
      })
      .returning();

    return NextResponse.json({
      simcha: created,
      message: autoApprove
        ? "Simcha posted successfully!"
        : "Simcha submitted for review. It will appear once approved.",
    }, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating simcha:", error);
    return NextResponse.json({ error: "Failed to submit simcha" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create community alerts POST endpoint**

Create `src/app/api/community/alerts/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { alerts, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, content, alertType, urgency } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!content?.trim() || content.length < 10) {
      return NextResponse.json({ error: "Content must be at least 10 characters" }, { status: 400 });
    }
    if (!alertType) {
      return NextResponse.json({ error: "Alert type is required" }, { status: 400 });
    }

    const validTypes = ["general", "bulletin", "announcement", "warning"];
    if (!validTypes.includes(alertType)) {
      return NextResponse.json({ error: "Invalid alert type" }, { status: 400 });
    }

    const validUrgencies = ["normal", "high", "urgent"];
    const finalUrgency = validUrgencies.includes(urgency) ? urgency : "normal";

    // Check auto-approve permission
    const userId = parseInt(session.user.id);
    const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const autoApprove = dbUser?.canAutoApproveAlerts || session.user.role === "admin";

    const [created] = await db
      .insert(alerts)
      .values({
        userId,
        title: title.trim(),
        content: content.trim(),
        alertType,
        urgency: finalUrgency,
        approvalStatus: autoApprove ? "approved" : "pending",
        isActive: true,
      })
      .returning();

    return NextResponse.json({
      alert: created,
      message: autoApprove
        ? "Alert posted successfully!"
        : "Alert submitted for review. It will appear once approved.",
    }, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating alert:", error);
    return NextResponse.json({ error: "Failed to submit alert" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/simcha-types/route.ts src/app/api/community/simchas/route.ts src/app/api/community/alerts/route.ts
git commit -m "feat: add public API endpoints for simcha and alert submissions"
```

---

## Task 3: SimchaSubmitModal Component

**Files:**
- Create: `src/components/simchas/SimchaSubmitModal.tsx`

- [ ] **Step 1: Create SimchaSubmitModal**

Create `src/components/simchas/SimchaSubmitModal.tsx`. This follows the exact KosherAlertSubmitModal pattern with these additions:
- Fetches simcha types from `/api/simcha-types` on mount
- Photo upload with preview using existing `/api/upload` endpoint (folder: "simchas")
- Image preview before submission with remove button
- Fields: familyName (required), typeId (dropdown), announcement (required, textarea), eventDate, location, photo

Key patterns to follow from KosherAlertSubmitModal:
- `useSession()` for auth check
- Show sign-in prompt if not logged in (with Register + Sign In buttons)
- `useState` for form + isSubmitting + isOpen
- `resetForm()` helper
- Toast on success/error
- Close dialog on success

Photo upload pattern (matching admin shul upload):
- File input with drag-and-drop feel (styled label)
- On file select: upload to `/api/upload` with FormData, folder="simchas"
- Show preview of uploaded image with remove (X) button
- Store the returned URL in form state as `photoUrl`
- 4MB max, JPEG/PNG/WebP only (validated client-side before upload)

```typescript
// Key structure (full implementation in the step):
"use client";
// imports...

export function SimchaSubmitModal() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [simchaTypes, setSimchaTypes] = useState([]);
  const [form, setForm] = useState({
    familyName: "",
    typeId: "",
    announcement: "",
    eventDate: "",
    location: "",
    photoUrl: "",
  });

  // Fetch types on mount
  useEffect(() => {
    fetch("/api/simcha-types").then(r => r.json()).then(setSimchaTypes);
  }, []);

  // Photo upload handler
  const handlePhotoUpload = async (file: File) => {
    // Validate size and type client-side
    // Upload via /api/upload with folder="simchas"
    // Set form.photoUrl from response
  };

  // Submit handler - POST to /api/community/simchas
  // Reset form and close on success
  // Show toast with auto-approve or pending message

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button><Plus /> Share a Simcha</Button>
      </DialogTrigger>
      <DialogContent>
        {/* Auth check, form fields, photo upload area */}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/simchas/SimchaSubmitModal.tsx
git commit -m "feat: add SimchaSubmitModal with photo upload"
```

---

## Task 4: AlertSubmitModal Component

**Files:**
- Create: `src/components/alerts/AlertSubmitModal.tsx`

- [ ] **Step 1: Create AlertSubmitModal**

Create `src/components/alerts/AlertSubmitModal.tsx`. Same pattern as KosherAlertSubmitModal:
- `useSession()` for auth, sign-in prompt if not logged in
- Fields: title (required), alertType (dropdown: general/bulletin/announcement/warning), urgency (dropdown: normal/high/urgent), content (required, textarea min 10 chars)
- POST to `/api/community/alerts`
- Toast success/error, close on success, reset form

```typescript
// Key structure:
"use client";
// imports matching KosherAlertSubmitModal...

const ALERT_TYPES = [
  { value: "general", label: "General" },
  { value: "bulletin", label: "Bulletin" },
  { value: "announcement", label: "Announcement" },
  { value: "warning", label: "Warning" },
];

const URGENCY_LEVELS = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function AlertSubmitModal() {
  // Same auth + form pattern as KosherAlertSubmitModal
  // Button label: "Submit Alert" with Plus icon
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/alerts/AlertSubmitModal.tsx
git commit -m "feat: add AlertSubmitModal component"
```

---

## Task 5: Wire Modals into Public Pages + Fix Community Corner

**Files:**
- Modify: `src/app/(public)/simchas/page.tsx`
- Modify: `src/app/(public)/alerts/page.tsx`
- Modify: `src/components/home/CommunityCornerTabs.tsx`

- [ ] **Step 1: Add SimchaSubmitModal to simchas page header**

In `src/app/(public)/simchas/page.tsx`, the page is a server component. Add the modal to the header section. Import and render `<SimchaSubmitModal />` in the header div, alongside the title — matching the Shiva page pattern where `<ShivaSubmitModal />` is placed in the header buttons area.

Update the header from:
```tsx
<div className="flex items-center gap-3 mb-4">
  <PartyPopper className="h-8 w-8" />
  <h1 className="text-3xl md:text-4xl font-bold">Simchas</h1>
</div>
```

To:
```tsx
<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
  <div>
    <div className="flex items-center gap-3 mb-4">
      <PartyPopper className="h-8 w-8" />
      <h1 className="text-3xl md:text-4xl font-bold">Simchas</h1>
    </div>
    <p className="text-purple-200 max-w-2xl">
      Celebrate with the Toronto Jewish community! Share in the joy of
      engagements, weddings, births, bar/bat mitzvahs, and other simchas.
    </p>
  </div>
  <SimchaSubmitModal />
</div>
```

(Move the `<p>` tag inside the left div, add modal on the right.)

- [ ] **Step 2: Add AlertSubmitModal to alerts page header**

Same pattern in `src/app/(public)/alerts/page.tsx`. Update header:

```tsx
<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
  <div>
    <div className="flex items-center gap-3 mb-4">
      <Bell className="h-8 w-8" />
      <h1 className="text-3xl md:text-4xl font-bold">Alerts & Bulletins</h1>
    </div>
    <p className="text-blue-200 max-w-2xl">
      Stay informed about community announcements, important updates, and bulletins
      for the Toronto Jewish community.
    </p>
  </div>
  <AlertSubmitModal />
</div>
```

- [ ] **Step 3: Fix Community Corner "Share a Simcha" link**

In `src/components/home/CommunityCornerTabs.tsx`, change the Simchas tab footer from:

```tsx
<Link href="/simchas/new">Share a Simcha</Link>
```

To:

```tsx
<Link href="/simchas">Share a Simcha</Link>
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(public)/simchas/page.tsx src/app/(public)/alerts/page.tsx src/components/home/CommunityCornerTabs.tsx
git commit -m "feat: wire submit modals into simchas and alerts pages, fix community corner link"
```

---

## Task 6: Admin Permissions Update

**Files:**
- Modify: Admin user permissions dialog (wherever the shield icon permissions are rendered)

- [ ] **Step 1: Find and update admin permissions dialog**

Search for the existing `canAutoApproveSimchas` references in the admin UI to find the permissions dialog component. Add `canAutoApproveAlerts` to the list of toggleable permissions.

This ensures admins can grant users the ability to auto-approve alert submissions, matching the existing pattern for all other content types.

- [ ] **Step 2: Update admin alerts page to show approval queue**

The admin alerts page at `src/app/(admin)/admin/alerts/page.tsx` may need an approval status filter for user-submitted alerts (pending/approved/rejected), similar to how admin kosher alerts page handles it. Add quick approve/reject buttons for pending submissions.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add canAutoApproveAlerts to admin permissions, update alerts admin page"
```
