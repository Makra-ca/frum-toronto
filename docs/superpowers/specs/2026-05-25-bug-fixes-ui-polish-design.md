# Bug Fixes & UI Polish — Design Spec
**Date:** 2026-05-25
**Scope:** 3 bug fixes + 3 UI improvements

---

## 1. Overview

This spec covers confirmed bugs and UI items. All file paths and before/after code are derived from reading the actual files — no guessing.

| # | Type | Item | Files Affected |
|---|------|------|---------------|
| B1 | Bug | GET /api/user/blog/[id] — route exists but was missing; now confirmed present but verify it returns right shape | `src/app/api/user/blog/[id]/route.ts` |
| B2 | Bug | Missing `pendingCommentsCount` in admin blog list response | `src/app/api/admin/blog/route.ts` |
| B3 | Bug | EruvWidget uses hardcoded placeholder data | `src/components/widgets/EruvWidget.tsx`, new `src/app/api/eruv/status/route.ts` |
| U1 | UI | Homepage orbit: replace Community node with Ask the Rabbi | `src/components/home/HeroSection.tsx` |
| U2 | UI | Sefirat HaOmer seasonal widget | new `src/components/widgets/OmerWidget.tsx` |
| U3 | UI | Navbar 14" laptop overflow fix | `src/components/layout/Header.tsx` |

---

## 2. Bug Fix 1: GET /api/user/blog/[id] — Verify Response Shape

### Finding

After reading the file, `GET /api/user/blog/[id]` **does already exist** at `src/app/api/user/blog/[id]/route.ts`. The route was not missing — it just returns the raw Drizzle row from `blogPosts` without joining category name.

The dashboard edit page (`src/app/(dashboard)/dashboard/blog/[id]/edit/page.tsx`) fetches from `/api/user/blog/${id}` and reads these fields:

```typescript
interface BlogPostData {
  id: number;
  title: string;
  slug: string;
  content: string;
  contentJson: unknown;
  coverImageUrl: string | null;
  excerpt: string | null;
  categoryId: number | null;
  customCategory: string | null;
  commentModeration: string | null;
  approvalStatus: string;
}
```

The current GET handler returns the full `blogPosts` row via `db.select().from(blogPosts)` — all those fields are present. The route is functional.

### Actual Problem

The edit page also calls `PATCH /api/user/blog/${id}` to save. The PATCH validates the full `blogPostSchema` including the required `content` field. When TipTap is in use, `content` is the HTML string — this should work. **No code change needed for B1 unless testing reveals a specific field mismatch.**

### Verification Step (for executor)

Before marking B1 done, manually test: log in as a non-admin user, navigate to `/dashboard/blog`, click Edit on a pending post. If it 404s or throws, check that `blogPosts.isActive` filtering isn't silently excluding the post (the current GET does **not** filter by `isActive` — good).

---

## 3. Bug Fix 2: Missing `pendingCommentsCount` in Admin Blog API

### Problem

`src/app/(admin)/admin/programs/blog/page.tsx` line 137:
```typescript
setPendingCommentsCount(data.pendingCommentsCount || 0);
```

`src/app/api/admin/blog/route.ts` GET handler returns:
```typescript
return NextResponse.json({
  posts,
  pagination: { page, limit, totalCount, totalPages },
});
```

`pendingCommentsCount` is never included → the badge always shows 0.

### Fix

**File:** `src/app/api/admin/blog/route.ts`

Add a pending comments count query before the return statement:

```typescript
// BEFORE (line 104-112):
return NextResponse.json({
  posts,
  pagination: {
    page,
    limit,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
  },
});
```

```typescript
// AFTER:
// Count pending blog comments
const [pendingCommentsResult] = await db
  .select({ count: sql<number>`count(*)` })
  .from(blogComments)
  .where(
    and(
      eq(blogComments.approvalStatus, "pending"),
      eq(blogComments.isActive, true)
    )
  );
const pendingCommentsCount = Number(pendingCommentsResult?.count || 0);

return NextResponse.json({
  posts,
  pagination: {
    page,
    limit,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
  },
  pendingCommentsCount,
});
```

**Imports already present:** `blogComments` is already imported on line 4. `sql`, `and`, `eq` are already imported on line 5. No new imports needed.

---

## 4. Bug Fix 3: EruvWidget — Replace Hardcoded Data with Live DB Data

### Problem

`src/components/widgets/EruvWidget.tsx` uses a hardcoded const:

```typescript
// Placeholder data - will be replaced with real data from database
const eruvStatus = {
  isUp: true,
  message: "The eruv is up and in good condition this Shabbos.",
  lastUpdated: "Friday, Dec 13, 2024 at 2:30 PM",
  updatedBy: "Eruv Committee",
};
```

The `eruv_status` table exists in the schema with columns:
- `id`, `statusDate` (date, unique), `isUp` (boolean), `message` (varchar 500), `updatedBy` (integer FK → users), `updatedAt` (timestamp)

An admin-facing API exists at `/api/admin/eruv` but it requires admin auth. A public endpoint is needed.

### New API Route

**File to create:** `src/app/api/eruv/status/route.ts`

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eruvStatus } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [latest] = await db
      .select({
        id: eruvStatus.id,
        statusDate: eruvStatus.statusDate,
        isUp: eruvStatus.isUp,
        message: eruvStatus.message,
        updatedAt: eruvStatus.updatedAt,
      })
      .from(eruvStatus)
      .orderBy(desc(eruvStatus.statusDate))
      .limit(1);

    if (!latest) {
      return NextResponse.json({ status: null });
    }

    return NextResponse.json({ status: latest });
  } catch (error) {
    console.error("[API] Error fetching eruv status:", error);
    return NextResponse.json({ error: "Failed to fetch eruv status" }, { status: 500 });
  }
}
```

Note: `updatedBy` is an integer FK — don't join to `users` here, just omit it from the public response.

### Updated EruvWidget

**File to rewrite:** `src/components/widgets/EruvWidget.tsx`

Remove the hardcoded `eruvStatus` const. Add `useState` + `useEffect` to fetch from `/api/eruv/status`.

```typescript
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface EruvStatusData {
  id: number;
  statusDate: string;
  isUp: boolean;
  message: string | null;
  updatedAt: string;
}

export function EruvWidget() {
  const [status, setStatus] = useState<EruvStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/eruv/status")
      .then((res) => res.json())
      .then((data) => {
        setStatus(data.status || null);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!status) {
    return (
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Eruv Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Eruv status not available.</p>
          <Button asChild variant="ghost" size="sm" className="w-full mt-3">
            <Link href="/eruv">Eruv Information</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const StatusIcon = status.isUp ? CheckCircle2 : XCircle;
  const statusColor = status.isUp ? "text-green-600" : "text-red-600";
  const statusBg = status.isUp ? "bg-green-50" : "bg-red-50";
  const statusText = status.isUp ? "UP" : "DOWN";
  const badgeVariant = status.isUp ? "default" : "destructive";

  // Format updatedAt date
  const updatedAtFormatted = new Date(status.updatedAt).toLocaleString("en-CA", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  });

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <div className={`p-1 rounded-full ${statusBg}`}>
              <StatusIcon className={`h-5 w-5 ${statusColor}`} />
            </div>
            Eruv Status
          </span>
          <Badge
            variant={badgeVariant}
            className={
              status.isUp
                ? "bg-green-100 text-green-800 hover:bg-green-100"
                : ""
            }
          >
            {statusText}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {status.message && (
          <p className="text-sm text-gray-600">{status.message}</p>
        )}

        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Clock className="h-3 w-3" />
          <span>Updated: {updatedAtFormatted}</span>
        </div>

        <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-md">
          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Always verify eruv status before Shabbos. Call the eruv hotline for
            real-time updates.
          </p>
        </div>

        <Button asChild variant="ghost" size="sm" className="w-full">
          <Link href="/eruv">Eruv Information</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
```

---

## 5. UI Change 1: Homepage Orbit — Replace Community Node with Ask the Rabbi

### Current Node List

From `src/components/home/HeroSection.tsx`, the `communityNodes` array (lines 21-30) is:

```typescript
const communityNodes = [
  { id: "directory",  label: "Directory",   description: "100+ kosher businesses", icon: Building2,  href: "/directory",          color: "from-blue-500 to-blue-600"    },
  { id: "shuls",      label: "Shuls",        description: "Find your minyan",        icon: Landmark,   href: "/shuls",              color: "from-indigo-500 to-indigo-600" },
  { id: "events",     label: "Events",       description: "Community calendar",      icon: Calendar,   href: "/community/calendar", color: "from-purple-500 to-purple-600" },
  { id: "classifieds",label: "Classifieds",  description: "Buy, sell & trade",       icon: Tag,        href: "/classifieds",        color: "from-cyan-500 to-cyan-600"    },
  { id: "shiurim",    label: "Shiurim",      description: "Torah classes",           icon: BookOpen,   href: "/shiurim",            color: "from-emerald-500 to-emerald-600" },
  { id: "community",  label: "Community",    description: "Simchas & alerts",        icon: Users,      href: "/community",          color: "from-pink-500 to-pink-600"    },  // ← REPLACE THIS
  { id: "zmanim",     label: "Zmanim",       description: "Daily times",             icon: Clock,      href: "/zmanim",             color: "from-amber-500 to-amber-600"  },
  { id: "simchas",    label: "Simchas",      description: "Celebrate together",      icon: Heart,      href: "/simchas",            color: "from-rose-500 to-rose-600"    },
];
```

### Change

Replace the `community` node (index 5) with an Ask the Rabbi node.

**Before:**
```typescript
{ id: "community", label: "Community", description: "Simchas & alerts", icon: Users, href: "/community", color: "from-pink-500 to-pink-600" },
```

**After:**
```typescript
{ id: "ask-the-rabbi", label: "Ask Rabbi", description: "Torah Q&A", icon: MessageCircle, href: "/ask-the-rabbi", color: "from-violet-500 to-violet-600" },
```

**Icon change:** `Users` (currently used) → `MessageCircle` from lucide-react.

**Import change in HeroSection.tsx** — current imports include `Users` (used elsewhere in file — check before removing). `Users` is not used anywhere else in this file after the node change, so remove it. Add `MessageCircle`.

Current import line 14:
```typescript
import {
  Building2,
  Landmark,
  Calendar,
  Tag,
  BookOpen,
  Users,
  Clock,
  Heart,
  ChevronDown,
} from "lucide-react";
```

Updated:
```typescript
import {
  Building2,
  Landmark,
  Calendar,
  Tag,
  BookOpen,
  MessageCircle,
  Clock,
  Heart,
  ChevronDown,
} from "lucide-react";
```

**All other nodes stay exactly as-is.** The orbit rendering code is data-driven — no other changes needed.

---

## 6. UI Change 2: Sefirat HaOmer Widget

### Behavior

- Renders **only** during the 49-day Omer period (between Passover night and Shavuot)
- Returns `null` outside the Omer period — widget disappears from the row automatically
- Shows: current day number + weeks + days breakdown
- Location: in the widgets row on the homepage (same row as ZmanimWidget, EruvWidget, WeatherWidget)

### Omer Calculation

Uses `@hebcal/core` (already installed). The Omer runs from the 2nd night of Passover (16 Nisan) through the 49th day (Shavuot eve, 5 Sivan). Technically the Omer begins at nightfall after the first seder.

For simplicity, the widget calculates based on calendar date (not nightfall): if today is between 16 Nisan and 5 Sivan (inclusive), compute the day count.

```typescript
import { HDate } from "@hebcal/core";

function getOmerDay(today: Date): number | null {
  const hdate = new HDate(today);
  const hYear = hdate.getFullYear();

  // Omer start: 16 Nisan
  const omerStart = new HDate(16, "Nisan", hYear);
  // Omer end: 5 Sivan (day 49)
  const omerEnd = new HDate(5, "Sivan", hYear);

  const todayAbs = hdate.abs();
  const startAbs = omerStart.abs();
  const endAbs = omerEnd.abs();

  if (todayAbs < startAbs || todayAbs > endAbs) return null;

  return todayAbs - startAbs + 1; // Day 1 through 49
}

function formatOmerDay(day: number): { weeks: number; days: number } {
  return {
    weeks: Math.floor((day - 1) / 7),
    days: (day - 1) % 7,
  };
}
```

### File to Create

`src/components/widgets/OmerWidget.tsx`

```typescript
"use client";

import { useMemo } from "react";
import { HDate } from "@hebcal/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";

function getOmerDay(today: Date): number | null {
  const hdate = new HDate(today);
  const hYear = hdate.getFullYear();

  const omerStart = new HDate(16, "Nisan", hYear);
  const omerEnd = new HDate(5, "Sivan", hYear);

  const todayAbs = hdate.abs();
  const startAbs = omerStart.abs();
  const endAbs = omerEnd.abs();

  if (todayAbs < startAbs || todayAbs > endAbs) return null;
  return todayAbs - startAbs + 1;
}

const HEBREW_NUMBERS = [
  "", "אחד", "שניים", "שלושה", "ארבעה", "חמישה", "שישה", "שבעה",
  "שמונה", "תשעה", "עשרה",
];

export function OmerWidget() {
  const day = useMemo(() => getOmerDay(new Date()), []);

  if (!day) return null;

  const weeks = Math.floor((day - 1) / 7);
  const remainingDays = (day - 1) % 7;

  let breakdown = "";
  if (weeks > 0 && remainingDays > 0) {
    breakdown = `${weeks} week${weeks > 1 ? "s" : ""} and ${remainingDays} day${remainingDays > 1 ? "s" : ""}`;
  } else if (weeks > 0) {
    breakdown = `${weeks} week${weeks > 1 ? "s" : ""} exactly`;
  } else {
    breakdown = `${day} day${day > 1 ? "s" : ""}`;
  }

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
          Sefirat HaOmer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-center">
          <div className="text-4xl font-bold text-amber-600">{day}</div>
          <div className="text-sm text-gray-500">of 49 days</div>
        </div>
        <p className="text-sm text-center text-gray-700 font-medium">{breakdown}</p>
        <p className="text-xs text-center text-gray-400">
          {49 - day} day{49 - day !== 1 ? "s" : ""} remaining until Shavuot
        </p>
      </CardContent>
    </Card>
  );
}
```

### Widget Row Integration

The homepage widgets row is in `src/app/page.tsx`. Find where `<ZmanimWidget />`, `<EruvWidget />`, and `<WeatherWidget />` are rendered (they're in a grid/flex row). Add `<OmerWidget />` in the same row:

```tsx
import { OmerWidget } from "@/components/widgets/OmerWidget";

// In the widgets row:
<OmerWidget />
<ZmanimWidget />
<EruvWidget />
<WeatherWidget />
```

The `OmerWidget` returns `null` outside the Omer period, so it collapses cleanly. If the grid uses `grid-cols-3`, it may need to become `grid-cols-4` or use `auto-fit`. Read `src/app/page.tsx` to check the exact grid class before implementing.

---

## 7. UI Change 3: Navbar 14" Laptop Fit

### Current State (from reading Header.tsx)

```
- Desktop nav shown at: xl (1280px+)
- Mobile hamburger shown at: xl:hidden (< 1280px uses hamburger)
- Logo text: xl:hidden 2xl:flex (hidden at xl, shown at 2xl)
- Nav item font: text-[13px] px-2.5, upgrades to 2xl:text-sm 2xl:px-4
- Auth area: hidden md:flex on right side
```

A 14" laptop typically runs at **1366×768** or **1440×900** viewport. At 1366px wide this falls into the `xl` breakpoint range (1280–1535px). The nav IS shown at this size, but the issue is that all nav items + auth controls don't fit in the horizontal space.

### Diagnosis

Nav items at `xl` (as read from file):
1. Home
2. Directory (trigger)
3. Calendar (trigger)
4. Alerts (trigger)
5. Classifieds (trigger)
6. Shuls & Tefillos (trigger)
7. Ask The Rabbi (link)
8. Community (trigger)
9. Contact (trigger)

That's 9 items. At `text-[13px] px-2.5` each trigger has NavigationMenuTrigger default height + built-in padding from Radix. "Shuls & Tefillos" is the longest label.

On the right: logo image (40–48px) + no text at xl + gap + nav + gap + auth (login + sign up).

### Fix Options

**Preferred: shorten "Shuls & Tefillos" label + reduce gaps**

The label "Shuls & Tefillos" is visually long. Shorten to "Shuls" in the nav (the dropdown still shows full options).

Also tighten the header horizontal padding from `px-4` to `px-3` at xl only.

```tsx
// navigation.ts — no change needed, nav label comes from mainNavigation

// Header.tsx — change the item label display only at smaller sizes:
// OR update mainNavigation label to "Shuls"
```

The cleanest approach is to update `src/lib/constants/navigation.ts` — change the label:

```typescript
// BEFORE:
{ label: "Shuls & Tefillos", href: "/shuls", children: [...] }

// AFTER:
{ label: "Shuls", href: "/shuls", children: [...] }
```

The children dropdown still shows "Shul Directory" and "Tehillim List" — no information is lost.

**Additional: Reduce container padding at xl**

In `Header.tsx` line 69:
```tsx
// BEFORE:
<div className="container mx-auto px-4 py-2">

// AFTER:
<div className="container mx-auto px-4 xl:px-3 py-2">
```

**Additional: Reduce nav trigger padding**

The NavigationMenuTrigger uses `px-2.5` at xl. Check if reducing to `px-2` helps. Note: this is already minimal.

**Alternative: Switch hamburger breakpoint to 2xl**

If shrinking labels/padding still overflows, change the desktop nav to only show at `2xl`:

```tsx
// BEFORE:
<NavigationMenu className="hidden xl:flex" ...>
<Button ... className="xl:hidden">  {/* hamburger */}

// AFTER:
<NavigationMenu className="hidden 2xl:flex" ...>
<Button ... className="2xl:hidden">  {/* hamburger */}
```

And the auth area:
```tsx
// BEFORE:
<div className="hidden md:flex items-center gap-1 xl:gap-2">

// AFTER:
<div className="hidden md:flex items-center gap-1 2xl:gap-2">
```

**Recommendation:** Try the label shortening + px-3 approach first. If that resolves the 14" overflow without visual regression, stop there. Only escalate to the 2xl breakpoint flip if testing confirms it still overflows.

### Summary of Changes (in order of invasiveness)

1. Shorten nav label "Shuls & Tefillos" → "Shuls" in `src/lib/constants/navigation.ts`
2. Reduce header container padding at xl: `px-4 xl:px-3` in `Header.tsx`
3. If still overflowing: move hamburger breakpoint to 2xl in `Header.tsx`

---

## 8. New API Routes

| Route | File | Auth | Purpose |
|-------|------|------|---------|
| `GET /api/eruv/status` | `src/app/api/eruv/status/route.ts` | None (public) | Returns most recent eruv status entry |

No database migrations required — all tables exist.

---

## 9. Migration Notes

No schema changes required. All database tables referenced in this spec already exist:
- `eruv_status` — confirmed in `src/lib/db/schema.ts` line 568
- `blog_posts`, `blog_comments` — confirmed in schema

The only new files to create:
- `src/app/api/eruv/status/route.ts` (new public API route)
- `src/components/widgets/OmerWidget.tsx` (new widget)

Files to modify:
- `src/app/api/admin/blog/route.ts` — add `pendingCommentsCount` to GET response
- `src/components/widgets/EruvWidget.tsx` — replace hardcoded data with API fetch
- `src/components/home/HeroSection.tsx` — replace Community orbit node with Ask the Rabbi
- `src/lib/constants/navigation.ts` — shorten "Shuls & Tefillos" → "Shuls"
- `src/components/layout/Header.tsx` — reduce xl padding (and optionally move hamburger breakpoint)
- `src/app/page.tsx` — add `<OmerWidget />` to widgets row
