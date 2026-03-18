# Admin Sidebar Reorganization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse 16 flat admin sidebar links into 10 grouped links with tab-based sub-navigation, and build 2 missing admin pages (Eruv Status, Important Numbers).

**Architecture:** Move existing admin page files into grouped route directories (`/admin/shuls/*`, `/admin/businesses/*`, `/admin/programs/*`, `/admin/community/*`). Create a reusable `AdminTabs` component for tab navigation. Each group gets a Next.js layout that renders the tabs. API routes stay unchanged.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, Tailwind CSS, shadcn/ui, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-18-admin-sidebar-reorganization-design.md`

---

## Chunk 1: AdminTabs Component + Sidebar Update

### Task 1: Create the reusable AdminTabs component

**Files:**
- Create: `src/components/admin/AdminTabs.tsx`

This component is based on the existing pattern in `src/app/(admin)/admin/content/layout.tsx` (lines 29-52) but extracted as a reusable component with responsive behavior.

- [ ] **Step 1: Create AdminTabs component**

```tsx
// src/components/admin/AdminTabs.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Tab {
  href: string;
  label: string;
  icon?: LucideIcon;
}

interface AdminTabsProps {
  tabs: Tab[];
}

export function AdminTabs({ tabs }: AdminTabsProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: horizontal underline tabs */}
      <div className="hidden sm:block border-b border-gray-200">
        <nav className="flex gap-4 -mb-px">
          {tabs.map((tab) => {
            const isActive =
              pathname === tab.href ||
              pathname.startsWith(tab.href + "/");

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                {tab.icon && <tab.icon className="h-4 w-4" />}
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Mobile: vertical stack */}
      <div className="sm:hidden flex flex-col gap-1 bg-gray-50 rounded-lg p-2">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href ||
            pathname.startsWith(tab.href + "/");

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-200"
              )}
            >
              {tab.icon && <tab.icon className="h-4 w-4" />}
              {tab.label}
            </Link>
          );
        })}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/AdminTabs.tsx
git commit -m "feat: add reusable AdminTabs component with responsive layout"
```

### Task 2: Update the admin sidebar

**Files:**
- Modify: `src/components/admin/AdminLayoutClient.tsx`

Update the navItems array from 16 items to 10, and fix the active state logic.

- [ ] **Step 1: Update navItems and imports**

Replace the imports (lines 10-28) with:
```tsx
import {
  LayoutDashboard,
  Users,
  Building2,
  BookOpen,
  Settings,
  Home,
  Landmark,
  MessageSquare,
  Mail,
  CheckCircle,
  Heart,
} from "lucide-react";
```

Replace the navItems array (lines 30-47) with:
```tsx
const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/shuls", label: "Shuls", icon: Landmark },
  { href: "/admin/businesses", label: "Businesses", icon: Building2 },
  { href: "/admin/programs", label: "Programs", icon: BookOpen },
  { href: "/admin/community", label: "Community", icon: Heart },
  { href: "/admin/approvals", label: "Approvals", icon: CheckCircle },
  { href: "/admin/newsletters", label: "Newsletters", icon: Mail },
  { href: "/admin/contacts", label: "Contact Messages", icon: MessageSquare },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];
```

- [ ] **Step 2: Update active state logic**

In the SidebarContent component (line 66-68), update the isActive check:
```tsx
const isActive =
  item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + "/");
```

The `exact` flag is needed for Dashboard (`/admin`) so it doesn't match `/admin/users`, etc.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminLayoutClient.tsx
git commit -m "feat: update admin sidebar to 10 grouped navigation items"
```

---

## Chunk 2: Shuls Group (tabs + move pages)

### Task 3: Create the Shuls group layout with tabs

**Files:**
- Create: `src/app/(admin)/admin/shuls/layout.tsx`

This layout wraps all shuls sub-pages with tab navigation. It hides tabs on detail pages (`/admin/shuls/[id]`).

- [ ] **Step 1: Create shuls layout**

```tsx
// src/app/(admin)/admin/shuls/layout.tsx
"use client";

import { usePathname } from "next/navigation";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Building, ClipboardList, UserCog } from "lucide-react";

const shulTabs = [
  { href: "/admin/shuls", label: "All Shuls", icon: Building },
  { href: "/admin/shuls/requests", label: "Requests", icon: ClipboardList },
  { href: "/admin/shuls/managers", label: "Managers", icon: UserCog },
];

export default function ShulsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Hide tabs on detail pages like /admin/shuls/123 or /admin/shuls/123/davening
  const isDetailPage = /^\/admin\/shuls\/\d+/.test(pathname);

  return (
    <div className="space-y-6">
      {!isDetailPage && (
        <>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Shuls</h1>
            <p className="text-gray-600 mt-1">Manage synagogues, registration requests, and manager assignments</p>
          </div>
          <AdminTabs tabs={shulTabs} />
        </>
      )}
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Move shul-requests page**

Copy `src/app/(admin)/admin/shul-requests/page.tsx` to `src/app/(admin)/admin/shuls/requests/page.tsx`. The page content stays the same — it already calls `/api/admin/shul-requests` which is not moving.

Remove any page-level heading from the moved file if it duplicates the layout heading (check the existing file — it uses ShulRequestsTable component so likely has its own heading to remove).

- [ ] **Step 3: Move user-shuls page**

Copy `src/app/(admin)/admin/user-shuls/page.tsx` to `src/app/(admin)/admin/shuls/managers/page.tsx`. The page content stays the same — it calls `/api/admin/user-shuls` which is not moving.

Remove any page-level heading if it duplicates the layout heading.

- [ ] **Step 4: Update the existing shuls/page.tsx**

The existing `src/app/(admin)/admin/shuls/page.tsx` likely has its own `<h1>` heading. Remove it since the layout now provides the heading. Check the file and remove the heading only if present.

- [ ] **Step 5: Delete old directories**

```bash
rm -rf src/app/(admin)/admin/shul-requests/
rm -rf src/app/(admin)/admin/user-shuls/
```

- [ ] **Step 6: Commit**

```bash
git add -A src/app/(admin)/admin/shuls/ src/app/(admin)/admin/shul-requests/ src/app/(admin)/admin/user-shuls/
git commit -m "feat: group shuls, requests, managers under /admin/shuls with tabs"
```

---

## Chunk 3: Businesses Group (tabs + move pages)

### Task 4: Create the Businesses group layout with tabs

**Files:**
- Create: `src/app/(admin)/admin/businesses/layout.tsx`
- Move: `src/app/(admin)/admin/categories/page.tsx` → `src/app/(admin)/admin/businesses/categories/page.tsx`
- Move: `src/app/(admin)/admin/subscription-plans/page.tsx` → `src/app/(admin)/admin/businesses/plans/page.tsx`

- [ ] **Step 1: Create businesses layout**

```tsx
// src/app/(admin)/admin/businesses/layout.tsx
"use client";

import { AdminTabs } from "@/components/admin/AdminTabs";
import { Building2, FolderTree, CreditCard } from "lucide-react";

const businessTabs = [
  { href: "/admin/businesses", label: "All Businesses", icon: Building2 },
  { href: "/admin/businesses/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/businesses/plans", label: "Plans", icon: CreditCard },
];

export default function BusinessesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Businesses</h1>
        <p className="text-gray-600 mt-1">Manage business listings, categories, and subscription plans</p>
      </div>
      <AdminTabs tabs={businessTabs} />
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Move categories page**

Copy `src/app/(admin)/admin/categories/page.tsx` to `src/app/(admin)/admin/businesses/categories/page.tsx`. Remove any page-level heading that duplicates the layout heading.

- [ ] **Step 3: Move subscription plans page**

Copy `src/app/(admin)/admin/subscription-plans/page.tsx` to `src/app/(admin)/admin/businesses/plans/page.tsx`. Remove any page-level heading that duplicates the layout heading.

- [ ] **Step 4: Update existing businesses/page.tsx**

Remove any page-level heading from `src/app/(admin)/admin/businesses/page.tsx` if present, since the layout now provides it.

- [ ] **Step 5: Delete old directories**

```bash
rm -rf src/app/(admin)/admin/categories/
rm -rf src/app/(admin)/admin/subscription-plans/
```

- [ ] **Step 6: Commit**

```bash
git add -A src/app/(admin)/admin/businesses/ src/app/(admin)/admin/categories/ src/app/(admin)/admin/subscription-plans/
git commit -m "feat: group businesses, categories, plans under /admin/businesses with tabs"
```

---

## Chunk 4: Programs Group (tabs + move pages)

### Task 5: Create the Programs group with tabs and move pages

**Files:**
- Create: `src/app/(admin)/admin/programs/layout.tsx`
- Create: `src/app/(admin)/admin/programs/page.tsx` (redirect)
- Move: `src/app/(admin)/admin/events/page.tsx` → `src/app/(admin)/admin/programs/events/page.tsx`
- Move: `src/app/(admin)/admin/shiurim/page.tsx` → `src/app/(admin)/admin/programs/shiurim/page.tsx`
- Move: `src/app/(admin)/admin/rabbi-submissions/page.tsx` → `src/app/(admin)/admin/programs/rabbi/page.tsx`
- Move: `src/app/(admin)/admin/content/classifieds/page.tsx` → `src/app/(admin)/admin/programs/classifieds/page.tsx`
- Move: `src/app/(admin)/admin/specials/page.tsx` → `src/app/(admin)/admin/programs/specials/page.tsx`

- [ ] **Step 1: Create programs layout**

```tsx
// src/app/(admin)/admin/programs/layout.tsx
"use client";

import { AdminTabs } from "@/components/admin/AdminTabs";
import { Calendar, BookOpen, HelpCircle, ShoppingBag, Tag } from "lucide-react";

const programTabs = [
  { href: "/admin/programs/events", label: "Events", icon: Calendar },
  { href: "/admin/programs/shiurim", label: "Shiurim", icon: BookOpen },
  { href: "/admin/programs/rabbi", label: "Ask the Rabbi", icon: HelpCircle },
  { href: "/admin/programs/classifieds", label: "Classifieds", icon: ShoppingBag },
  { href: "/admin/programs/specials", label: "Specials", icon: Tag },
];

export default function ProgramsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Programs</h1>
        <p className="text-gray-600 mt-1">Manage events, shiurim, classifieds, and more</p>
      </div>
      <AdminTabs tabs={programTabs} />
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create programs redirect page**

```tsx
// src/app/(admin)/admin/programs/page.tsx
import { redirect } from "next/navigation";

export default function ProgramsPage() {
  redirect("/admin/programs/events");
}
```

- [ ] **Step 3: Move all 5 pages**

Move these files (copy content, remove page-level headings):
1. `src/app/(admin)/admin/events/page.tsx` → `src/app/(admin)/admin/programs/events/page.tsx`
2. `src/app/(admin)/admin/shiurim/page.tsx` → `src/app/(admin)/admin/programs/shiurim/page.tsx`
3. `src/app/(admin)/admin/rabbi-submissions/page.tsx` → `src/app/(admin)/admin/programs/rabbi/page.tsx`
4. `src/app/(admin)/admin/content/classifieds/page.tsx` → `src/app/(admin)/admin/programs/classifieds/page.tsx`
5. `src/app/(admin)/admin/specials/page.tsx` → `src/app/(admin)/admin/programs/specials/page.tsx`

All pages continue to use their existing API endpoints (e.g., `/api/admin/events`, `/api/admin/shiurim`, etc.) — no API changes needed.

- [ ] **Step 4: Delete old directories**

```bash
rm -rf src/app/(admin)/admin/events/
rm -rf src/app/(admin)/admin/shiurim/
rm -rf src/app/(admin)/admin/rabbi-submissions/
rm -rf src/app/(admin)/admin/specials/
```

Note: Don't delete `content/classifieds` yet — the entire content directory is cleaned up in Chunk 5.

- [ ] **Step 5: Commit**

```bash
git add -A src/app/(admin)/admin/programs/ src/app/(admin)/admin/events/ src/app/(admin)/admin/shiurim/ src/app/(admin)/admin/rabbi-submissions/ src/app/(admin)/admin/specials/
git commit -m "feat: group events, shiurim, rabbi, classifieds, specials under /admin/programs"
```

---

## Chunk 5: Community Group (tabs + move pages + new pages)

### Task 6: Create the Community group with tabs and move existing pages

**Files:**
- Create: `src/app/(admin)/admin/community/layout.tsx`
- Create: `src/app/(admin)/admin/community/page.tsx` (redirect)
- Move: `src/app/(admin)/admin/content/simchas/page.tsx` → `src/app/(admin)/admin/community/simchas/page.tsx`
- Move: `src/app/(admin)/admin/content/shiva/page.tsx` → `src/app/(admin)/admin/community/shiva/page.tsx`
- Move: `src/app/(admin)/admin/content/tehillim/page.tsx` → `src/app/(admin)/admin/community/tehillim/page.tsx`
- Move: `src/app/(admin)/admin/alerts/page.tsx` → `src/app/(admin)/admin/community/alerts/page.tsx`
- Move: `src/app/(admin)/admin/kosher-alerts/page.tsx` → `src/app/(admin)/admin/community/kosher-alerts/page.tsx`

- [ ] **Step 1: Create community layout**

```tsx
// src/app/(admin)/admin/community/layout.tsx
"use client";

import { AdminTabs } from "@/components/admin/AdminTabs";
import { Heart, Flower2, BookHeart, Bell, ShieldAlert, MapPin, Phone } from "lucide-react";

const communityTabs = [
  { href: "/admin/community/simchas", label: "Simchas", icon: Heart },
  { href: "/admin/community/shiva", label: "Shiva", icon: Flower2 },
  { href: "/admin/community/tehillim", label: "Tehillim", icon: BookHeart },
  { href: "/admin/community/alerts", label: "Alerts", icon: Bell },
  { href: "/admin/community/kosher-alerts", label: "Kosher Alerts", icon: ShieldAlert },
  { href: "/admin/community/eruv", label: "Eruv", icon: MapPin },
  { href: "/admin/community/important-numbers", label: "Important Numbers", icon: Phone },
];

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Community</h1>
        <p className="text-gray-600 mt-1">Manage simchas, shiva, tehillim, alerts, and community resources</p>
      </div>
      <AdminTabs tabs={communityTabs} />
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create community redirect page**

```tsx
// src/app/(admin)/admin/community/page.tsx
import { redirect } from "next/navigation";

export default function CommunityPage() {
  redirect("/admin/community/simchas");
}
```

- [ ] **Step 3: Move all 5 existing pages**

Move these files (copy content, remove page-level headings):
1. `src/app/(admin)/admin/content/simchas/page.tsx` → `src/app/(admin)/admin/community/simchas/page.tsx`
2. `src/app/(admin)/admin/content/shiva/page.tsx` → `src/app/(admin)/admin/community/shiva/page.tsx`
3. `src/app/(admin)/admin/content/tehillim/page.tsx` → `src/app/(admin)/admin/community/tehillim/page.tsx`
4. `src/app/(admin)/admin/alerts/page.tsx` → `src/app/(admin)/admin/community/alerts/page.tsx`
5. `src/app/(admin)/admin/kosher-alerts/page.tsx` → `src/app/(admin)/admin/community/kosher-alerts/page.tsx`

All pages continue to use their existing API endpoints — no API changes needed.

- [ ] **Step 4: Delete old directories**

```bash
rm -rf src/app/(admin)/admin/alerts/
rm -rf src/app/(admin)/admin/kosher-alerts/
```

Note: Don't delete the `content/` directory yet — it's cleaned up in Chunk 6 after approvals are moved.

- [ ] **Step 5: Commit**

```bash
git add -A src/app/(admin)/admin/community/ src/app/(admin)/admin/alerts/ src/app/(admin)/admin/kosher-alerts/
git commit -m "feat: group simchas, shiva, tehillim, alerts under /admin/community"
```

### Task 7: Build Eruv Status admin page

**Files:**
- Create: `src/app/(admin)/admin/community/eruv/page.tsx`
- Create: `src/app/api/admin/eruv/route.ts`
- Create: `src/app/api/admin/eruv/[id]/route.ts`

**Schema reference** (`src/lib/db/schema.ts` lines 567-574):
```
eruvStatus: id, statusDate (date, unique), isUp (boolean), message (varchar 500), updatedBy (integer refs users), updatedAt (timestamp)
```

- [ ] **Step 1: Create GET/POST API route**

```tsx
// src/app/api/admin/eruv/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { eruvStatus } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const statuses = await db
    .select()
    .from(eruvStatus)
    .orderBy(desc(eruvStatus.statusDate))
    .limit(30);

  return NextResponse.json(statuses);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { statusDate, isUp, message } = body;

  if (!statusDate || typeof isUp !== "boolean") {
    return NextResponse.json({ error: "statusDate and isUp are required" }, { status: 400 });
  }

  const [entry] = await db
    .insert(eruvStatus)
    .values({
      statusDate,
      isUp,
      message: message || null,
      updatedBy: parseInt(session.user.id),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: eruvStatus.statusDate,
      set: {
        isUp,
        message: message || null,
        updatedBy: parseInt(session.user.id),
        updatedAt: new Date(),
      },
    })
    .returning();

  return NextResponse.json(entry, { status: 201 });
}
```

- [ ] **Step 2: Create PATCH API route**

```tsx
// src/app/api/admin/eruv/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { eruvStatus } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const [updated] = await db
    .update(eruvStatus)
    .set({
      ...body,
      updatedBy: parseInt(session.user.id),
      updatedAt: new Date(),
    })
    .where(eq(eruvStatus.id, parseInt(id)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
```

- [ ] **Step 3: Create Eruv admin page**

Create `src/app/(admin)/admin/community/eruv/page.tsx` — a client component with:
- Form at top: date picker (default today), Up/Down toggle buttons, message textarea, Save button
- Table below: recent statuses with date, status badge (green "Up" / red "Down"), message, updated timestamp
- Use existing patterns from other admin pages (fetch on mount, useState for form, toast on save)
- API calls to `/api/admin/eruv`

The page should be a standard admin CRUD page following the same patterns as other admin pages in this codebase (useState for data, useEffect for fetch, toast for notifications).

- [ ] **Step 4: Commit**

```bash
git add src/app/(admin)/admin/community/eruv/ src/app/api/admin/eruv/
git commit -m "feat: add eruv status admin page with API"
```

### Task 8: Build Important Numbers admin page

**Files:**
- Create: `src/app/(admin)/admin/community/important-numbers/page.tsx`
- Create: `src/app/api/admin/important-numbers/route.ts`
- Create: `src/app/api/admin/important-numbers/[id]/route.ts`

**Schema reference** (`src/lib/db/schema.ts` lines 580-588):
```
importantNumbers: id, category (varchar 100), name (varchar 200), phone (varchar 50), description (varchar 500), isEmergency (boolean), displayOrder (integer)
```

- [ ] **Step 1: Create GET/POST API route**

```tsx
// src/app/api/admin/important-numbers/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { importantNumbers } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const numbers = await db
    .select()
    .from(importantNumbers)
    .orderBy(asc(importantNumbers.displayOrder), asc(importantNumbers.name));

  return NextResponse.json(numbers);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, phone, category, description, isEmergency, displayOrder } = body;

  if (!name?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
  }

  const [entry] = await db
    .insert(importantNumbers)
    .values({
      name: name.trim(),
      phone: phone.trim(),
      category: category?.trim() || null,
      description: description?.trim() || null,
      isEmergency: isEmergency ?? false,
      displayOrder: displayOrder ?? 0,
    })
    .returning();

  return NextResponse.json(entry, { status: 201 });
}
```

- [ ] **Step 2: Create PATCH/DELETE API route**

```tsx
// src/app/api/admin/important-numbers/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { importantNumbers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const [updated] = await db
    .update(importantNumbers)
    .set(body)
    .where(eq(importantNumbers.id, parseInt(id)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await db.delete(importantNumbers).where(eq(importantNumbers.id, parseInt(id)));

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Create Important Numbers admin page**

Create `src/app/(admin)/admin/community/important-numbers/page.tsx` — a client component with:
- "Add Number" button that opens a dialog with: name, phone, category (text input), description, isEmergency checkbox, displayOrder number input
- Table showing all numbers: name, phone, category, emergency badge, order, edit/delete buttons
- Edit opens same dialog pre-filled
- Delete shows AlertDialog confirmation
- API calls to `/api/admin/important-numbers`

Follow the same patterns as other admin pages (useState, useEffect, Dialog, AlertDialog, toast).

- [ ] **Step 4: Commit**

```bash
git add src/app/(admin)/admin/community/important-numbers/ src/app/api/admin/important-numbers/
git commit -m "feat: add important numbers admin page with CRUD API"
```

---

## Chunk 6: Move Approvals + Clean Up Content + Fix Hardcoded Links

### Task 9: Move approvals to standalone page

**Files:**
- Move: `src/app/(admin)/admin/content/approvals/page.tsx` → `src/app/(admin)/admin/approvals/page.tsx`
- Move: `src/app/(admin)/admin/content/approvals/approvals-client.tsx` → `src/app/(admin)/admin/approvals/approvals-client.tsx`

- [ ] **Step 1: Move approvals directory**

Copy `src/app/(admin)/admin/content/approvals/` to `src/app/(admin)/admin/approvals/`.

The page.tsx is a server component that fetches pending counts and passes them to approvals-client.tsx. Neither file references the `/admin/content/` path in its logic — they use `/api/admin/content/` for API calls which is NOT changing.

Add a page-level heading since it's no longer inside the content layout:

In `approvals-client.tsx`, add a heading at the top of the returned JSX:
```tsx
<div>
  <h1 className="text-3xl font-bold text-gray-900">Approvals</h1>
  <p className="text-gray-600 mt-1">Review pending community submissions</p>
</div>
```

- [ ] **Step 2: Delete the entire old content directory**

At this point, all content sub-pages have been moved:
- `content/approvals/` → `approvals/`
- `content/classifieds/` → `programs/classifieds/`
- `content/simchas/` → `community/simchas/`
- `content/shiva/` → `community/shiva/`
- `content/tehillim/` → `community/tehillim/`

```bash
rm -rf src/app/(admin)/admin/content/
```

- [ ] **Step 3: Commit**

```bash
git add -A src/app/(admin)/admin/approvals/ src/app/(admin)/admin/content/
git commit -m "feat: move approvals to standalone /admin/approvals, delete old content directory"
```

### Task 10: Fix hardcoded admin links

**Files:**
- Modify: `src/app/(admin)/admin/page.tsx` (dashboard links)
- Modify: `src/app/api/community/shiva/route.ts` (email template)
- Modify: `src/app/api/community/tehillim/route.ts` (email template)

- [ ] **Step 1: Update dashboard links**

In `src/app/(admin)/admin/page.tsx`:
- Line 90: Change `/admin/content?status=pending` → `/admin/approvals`
- Line 105: Change `/admin/content?type=classifieds&status=pending` → `/admin/approvals`

- [ ] **Step 2: Update shiva email template**

In `src/app/api/community/shiva/route.ts`:
- Line 149: Change `/admin/content/shiva` → `/admin/community/shiva`

- [ ] **Step 3: Update tehillim email template**

In `src/app/api/community/tehillim/route.ts`:
- Line 133: Change `/admin/content` → `/admin/community/tehillim`

- [ ] **Step 4: Commit**

```bash
git add src/app/(admin)/admin/page.tsx src/app/api/community/shiva/route.ts src/app/api/community/tehillim/route.ts
git commit -m "fix: update hardcoded admin links to new routes"
```

---

## Chunk 7: Verification

### Task 11: Verify everything works

- [ ] **Step 1: Check for any remaining references to old routes**

Search the entire `src/` directory for references to deleted routes:
```bash
grep -r "/admin/shul-requests\|/admin/user-shuls\|/admin/categories\|/admin/subscription-plans\|/admin/events\|/admin/specials\|/admin/alerts\|/admin/kosher-alerts\|/admin/rabbi-submissions\|/admin/content" src/ --include="*.tsx" --include="*.ts" -l
```

Expected: Only API route files (under `src/app/api/`) should match — those are NOT moving. Page files should have zero matches.

- [ ] **Step 2: Verify all new routes have page files**

Check these files exist:
```
src/app/(admin)/admin/shuls/layout.tsx
src/app/(admin)/admin/shuls/requests/page.tsx
src/app/(admin)/admin/shuls/managers/page.tsx
src/app/(admin)/admin/businesses/layout.tsx
src/app/(admin)/admin/businesses/categories/page.tsx
src/app/(admin)/admin/businesses/plans/page.tsx
src/app/(admin)/admin/programs/layout.tsx
src/app/(admin)/admin/programs/page.tsx
src/app/(admin)/admin/programs/events/page.tsx
src/app/(admin)/admin/programs/shiurim/page.tsx
src/app/(admin)/admin/programs/rabbi/page.tsx
src/app/(admin)/admin/programs/classifieds/page.tsx
src/app/(admin)/admin/programs/specials/page.tsx
src/app/(admin)/admin/community/layout.tsx
src/app/(admin)/admin/community/page.tsx
src/app/(admin)/admin/community/simchas/page.tsx
src/app/(admin)/admin/community/shiva/page.tsx
src/app/(admin)/admin/community/tehillim/page.tsx
src/app/(admin)/admin/community/alerts/page.tsx
src/app/(admin)/admin/community/kosher-alerts/page.tsx
src/app/(admin)/admin/community/eruv/page.tsx
src/app/(admin)/admin/community/important-numbers/page.tsx
src/app/(admin)/admin/approvals/page.tsx
src/app/(admin)/admin/approvals/approvals-client.tsx
```

- [ ] **Step 3: Verify old directories are deleted**

Check these directories no longer exist:
```
src/app/(admin)/admin/shul-requests/
src/app/(admin)/admin/user-shuls/
src/app/(admin)/admin/categories/
src/app/(admin)/admin/subscription-plans/
src/app/(admin)/admin/events/
src/app/(admin)/admin/specials/
src/app/(admin)/admin/alerts/
src/app/(admin)/admin/kosher-alerts/
src/app/(admin)/admin/rabbi-submissions/
src/app/(admin)/admin/content/
```

- [ ] **Step 4: Run the dev server and spot-check**

```bash
npm run dev
```

Manually verify in browser:
1. Sidebar shows 10 items
2. Click "Shuls" → shows tabs, click each tab
3. Click "Businesses" → shows tabs, click each tab
4. Click "Programs" → redirects to events, click each tab
5. Click "Community" → redirects to simchas, click each tab
6. Click "Approvals" → shows approval queue
7. Navigate to a shul detail page → tabs are hidden

- [ ] **Step 5: Update CLAUDE.md**

Update the session notes in `CLAUDE.md` with a summary of the sidebar reorganization changes.
