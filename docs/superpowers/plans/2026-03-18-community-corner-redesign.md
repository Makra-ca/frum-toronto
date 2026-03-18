# Community Corner Tabs Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the homepage Community Corner from 4 tabs to 6 (adding Kosher Alerts + Bulletin Alerts), and change display from multi-item list to one-at-a-time carousel with prev/next arrows.

**Architecture:** Server component (`CommunityCornerTabs`) fetches all 6 datasets via `Promise.all` and passes them as serialized props to a new client component (`CommunityCornerClient`) that handles tab switching, carousel navigation, and slide animations. No new API routes.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, Tailwind CSS v4, shadcn/ui, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-18-community-corner-redesign.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/components/home/CommunityCornerTabs.tsx` | **Rewrite** | Server component — fetches 6 datasets, serializes dates, passes props to client |
| `src/components/home/CommunityCornerClient.tsx` | **Create** | Client component — tabs UI, carousel with prev/next arrows, dot indicators, slide animation |
| `src/components/home/CommunityCornerActions.tsx` | **Modify** | Add `KosherAlertActions` and `BulletinAlertActions` exports |

No changes to `src/app/page.tsx` — the `<CommunityCornerTabs />` import stays the same.

---

## Task 1: Update CommunityCornerActions with new tab actions

**Files:**
- Modify: `src/components/home/CommunityCornerActions.tsx`

- [ ] **Step 1: Check if KosherAlertSubmitModal exists**

Run: `ls src/components/kosher-alerts/KosherAlertSubmitModal.tsx`

If it exists, proceed. If not, the Kosher Alerts tab will only have a "View All" link (no submit button).

- [ ] **Step 2: Add KosherAlertActions and BulletinAlertActions exports**

Add to the bottom of `src/components/home/CommunityCornerActions.tsx`:

```tsx
import { KosherAlertSubmitModal } from "@/components/kosher-alerts/KosherAlertSubmitModal";

export function KosherAlertActions() {
  return (
    <div className="mt-4 pt-4 border-t flex gap-2">
      <div className="flex-1 [&_button]:w-full [&_button]:bg-transparent [&_button]:text-foreground [&_button]:border [&_button]:border-input [&_button]:shadow-xs [&_button]:hover:bg-accent [&_button]:hover:text-accent-foreground">
        <KosherAlertSubmitModal />
      </div>
      <Button asChild variant="ghost" className="flex-1">
        <Link href="/kosher-alerts">
          View All <ArrowRight className="h-4 w-4 ml-2" />
        </Link>
      </Button>
    </div>
  );
}

export function BulletinAlertActions() {
  return (
    <div className="mt-4 pt-4 border-t flex gap-2">
      <Button asChild variant="ghost" className="flex-1 ml-auto">
        <Link href="/alerts">
          View All <ArrowRight className="h-4 w-4 ml-2" />
        </Link>
      </Button>
    </div>
  );
}
```

Note: `BulletinAlertActions` has only a "View All" link — there is no user-facing submit modal for bulletin alerts (admin-only content). `KosherAlertSubmitModal` already exists and handles login-required gating internally.

- [ ] **Step 3: Verify the import for KosherAlertSubmitModal resolves**

Check the component exists and exports correctly:

Run: `grep -n "export" src/components/kosher-alerts/KosherAlertSubmitModal.tsx | head -5`

- [ ] **Step 4: Commit**

```bash
git add src/components/home/CommunityCornerActions.tsx
git commit -m "feat: add KosherAlertActions and BulletinAlertActions to CommunityCornerActions"
```

---

## Task 2: Rewrite CommunityCornerTabs server component

**Files:**
- Rewrite: `src/components/home/CommunityCornerTabs.tsx`

- [ ] **Step 1: Rewrite the server component with all 6 data fetchers**

Replace the entire file with:

```tsx
import { db } from "@/lib/db";
import {
  askTheRabbi,
  simchas,
  simchaTypes,
  shivaNotifications,
  tehillimList,
  alerts,
  kosherAlerts,
} from "@/lib/db/schema";
import { desc, eq, gte, and, or, isNull } from "drizzle-orm";
import { CommunityCornerClient } from "@/components/home/CommunityCornerClient";

async function getRecentQuestions() {
  return db
    .select({
      id: askTheRabbi.id,
      questionNumber: askTheRabbi.questionNumber,
      title: askTheRabbi.title,
      question: askTheRabbi.question,
    })
    .from(askTheRabbi)
    .where(eq(askTheRabbi.isPublished, true))
    .orderBy(desc(askTheRabbi.questionNumber))
    .limit(10);
}

async function getRecentSimchas() {
  return db
    .select({
      id: simchas.id,
      familyName: simchas.familyName,
      announcement: simchas.announcement,
      eventDate: simchas.eventDate,
      typeName: simchaTypes.name,
    })
    .from(simchas)
    .leftJoin(simchaTypes, eq(simchas.typeId, simchaTypes.id))
    .where(
      and(eq(simchas.isActive, true), eq(simchas.approvalStatus, "approved"))
    )
    .orderBy(desc(simchas.createdAt))
    .limit(10);
}

async function getKosherAlerts() {
  return db
    .select({
      id: kosherAlerts.id,
      productName: kosherAlerts.productName,
      brand: kosherAlerts.brand,
      alertType: kosherAlerts.alertType,
      certifyingAgency: kosherAlerts.certifyingAgency,
      description: kosherAlerts.description,
    })
    .from(kosherAlerts)
    .where(
      and(
        eq(kosherAlerts.isActive, true),
        eq(kosherAlerts.approvalStatus, "approved")
      )
    )
    .orderBy(desc(kosherAlerts.createdAt))
    .limit(10);
}

async function getBulletinAlerts() {
  const now = new Date();
  return db
    .select({
      id: alerts.id,
      title: alerts.title,
      content: alerts.content,
      alertType: alerts.alertType,
      urgency: alerts.urgency,
      createdAt: alerts.createdAt,
    })
    .from(alerts)
    .where(
      and(
        eq(alerts.isActive, true),
        eq(alerts.approvalStatus, "approved"),
        or(isNull(alerts.expiresAt), gte(alerts.expiresAt, now))
      )
    )
    .orderBy(desc(alerts.isPinned), desc(alerts.createdAt))
    .limit(10);
}

async function getShivaNotices() {
  const today = new Date().toISOString().split("T")[0];
  return db
    .select({
      id: shivaNotifications.id,
      niftarName: shivaNotifications.niftarName,
      mournerNames: shivaNotifications.mournerNames,
      shivaAddress: shivaNotifications.shivaAddress,
      shivaEnd: shivaNotifications.shivaEnd,
    })
    .from(shivaNotifications)
    .where(
      and(
        eq(shivaNotifications.approvalStatus, "approved"),
        gte(shivaNotifications.shivaEnd, today)
      )
    )
    .orderBy(shivaNotifications.shivaEnd)
    .limit(10);
}

async function getTehillimNames() {
  return db
    .select({
      id: tehillimList.id,
      hebrewName: tehillimList.hebrewName,
      englishName: tehillimList.englishName,
      motherHebrewName: tehillimList.motherHebrewName,
      reason: tehillimList.reason,
    })
    .from(tehillimList)
    .where(
      and(
        eq(tehillimList.isActive, true),
        eq(tehillimList.approvalStatus, "approved")
      )
    )
    .orderBy(desc(tehillimList.createdAt))
    .limit(10);
}

export async function CommunityCornerTabs() {
  const [
    askTheRabbiItems,
    simchasItems,
    kosherAlertItems,
    bulletinAlertItems,
    shivaItems,
    tehillimItems,
  ] = await Promise.all([
    getRecentQuestions(),
    getRecentSimchas(),
    getKosherAlerts(),
    getBulletinAlerts(),
    getShivaNotices(),
    getTehillimNames(),
  ]);

  return (
    <section>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Community Corner
      </h2>
      <CommunityCornerClient
        askTheRabbiItems={askTheRabbiItems}
        simchasItems={simchasItems.map((s) => ({
          ...s,
          eventDate: s.eventDate ? String(s.eventDate) : null,
        }))}
        kosherAlertItems={kosherAlertItems}
        bulletinAlertItems={bulletinAlertItems.map((a) => ({
          ...a,
          urgency: a.urgency ?? "normal",
          createdAt: a.createdAt ? a.createdAt.toISOString() : new Date().toISOString(),
        }))}
        shivaItems={shivaItems.map((s) => ({
          ...s,
          mournerNames: Array.isArray(s.mournerNames)
            ? (s.mournerNames as string[])
            : null,
          shivaEnd: s.shivaEnd ? String(s.shivaEnd) : null,
        }))}
        tehillimItems={tehillimItems}
      />
    </section>
  );
}
```

Key details:
- All queries now `limit(10)` instead of 2-4
- Dates and JSONB are serialized before passing to client (Date → ISO string, mournerNames cast to `string[]`)
- `eventDate` converted to string for serialization
- Bulletin alerts handle nullable `urgency` with fallback `"normal"`
- Bulletin alerts expiration handled with `isNull(expiresAt) OR expiresAt >= now()`

- [ ] **Step 2: Commit**

```bash
git add src/components/home/CommunityCornerTabs.tsx
git commit -m "feat: rewrite CommunityCornerTabs server component with 6 data fetchers"
```

---

## Task 3: Create CommunityCornerClient component

**Files:**
- Create: `src/components/home/CommunityCornerClient.tsx`

This is the main interactive component. It handles:
- 6 pill-style tabs (2-col grid on mobile, horizontal row on md+)
- One-at-a-time carousel per tab with prev/next chevron arrows
- Dot indicators
- CSS slide animation with `translateX`
- Per-tab action buttons via CommunityCornerActions

- [ ] **Step 1: Create the client component**

Create `src/components/home/CommunityCornerClient.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Heart,
  ShieldAlert,
  Bell,
  Users,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AskRabbiActions,
  SimchasActions,
  ShivaActions,
  KosherAlertActions,
  BulletinAlertActions,
} from "@/components/home/CommunityCornerActions";

// --- Types ---

interface AskRabbiItem {
  id: number;
  questionNumber: number | null;
  title: string;
  question: string | null;
}

interface SimchaItem {
  id: number;
  familyName: string;
  announcement: string | null;
  eventDate: string | null;
  typeName: string | null;
}

interface KosherAlertItem {
  id: number;
  productName: string;
  brand: string | null;
  alertType: string | null;
  certifyingAgency: string | null;
  description: string | null;
}

interface BulletinAlertItem {
  id: number;
  title: string;
  content: string | null;
  alertType: string;
  urgency: string;
  createdAt: string;
}

interface ShivaItem {
  id: number;
  niftarName: string;
  mournerNames: string[] | null;
  shivaAddress: string | null;
  shivaEnd: string | null;
}

interface TehillimItem {
  id: number;
  hebrewName: string | null;
  englishName: string | null;
  motherHebrewName: string | null;
  reason: string | null;
}

interface CommunityCornerClientProps {
  askTheRabbiItems: AskRabbiItem[];
  simchasItems: SimchaItem[];
  kosherAlertItems: KosherAlertItem[];
  bulletinAlertItems: BulletinAlertItem[];
  shivaItems: ShivaItem[];
  tehillimItems: TehillimItem[];
}

// --- Tab definitions ---

const TABS = [
  { key: "ask-rabbi", label: "Ask Rabbi", icon: MessageSquare, color: "purple" },
  { key: "simchas", label: "Simchas", icon: Heart, color: "pink" },
  { key: "kosher-alerts", label: "Kosher Alerts", icon: ShieldAlert, color: "red" },
  { key: "bulletin", label: "Bulletin Alerts", icon: Bell, color: "amber" },
  { key: "shiva", label: "Shiva", icon: Users, color: "gray" },
  { key: "tehillim", label: "Tehillim", icon: BookOpen, color: "blue" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// --- Color map for active tab pill ---

const TAB_COLORS: Record<string, { active: string; hover: string }> = {
  purple: { active: "bg-purple-100 text-purple-800", hover: "hover:bg-purple-50" },
  pink: { active: "bg-pink-100 text-pink-800", hover: "hover:bg-pink-50" },
  red: { active: "bg-red-100 text-red-800", hover: "hover:bg-red-50" },
  amber: { active: "bg-amber-100 text-amber-800", hover: "hover:bg-amber-50" },
  gray: { active: "bg-gray-200 text-gray-800", hover: "hover:bg-gray-100" },
  blue: { active: "bg-blue-100 text-blue-800", hover: "hover:bg-blue-50" },
};

// --- Helper: strip HTML tags ---

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

// --- Helper: truncate text ---

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}

// --- Helper: format date ---

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// --- Item renderers ---

function AskRabbiCard({ item }: { item: AskRabbiItem }) {
  return (
    <Link href={`/ask-the-rabbi/${item.id}`} className="block">
      <div className="p-4 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 line-clamp-2">{item.title}</h3>
          {item.questionNumber && (
            <Badge className="bg-purple-200 text-purple-800 shrink-0">
              #{item.questionNumber}
            </Badge>
          )}
        </div>
        {item.question && (
          <p className="text-sm text-gray-600 mt-2 line-clamp-3">
            {truncate(stripHtml(item.question), 150)}
          </p>
        )}
        <p className="text-xs text-purple-600 mt-2 font-medium">Read More →</p>
      </div>
    </Link>
  );
}

function SimchaCard({ item }: { item: SimchaItem }) {
  return (
    <div className="p-4 rounded-lg bg-pink-50">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-900">{item.familyName} Family</h3>
          {item.announcement && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-3">{item.announcement}</p>
          )}
        </div>
        {item.typeName && (
          <Badge className="bg-pink-200 text-pink-800 shrink-0">{item.typeName}</Badge>
        )}
      </div>
      {item.eventDate && (
        <p className="text-xs text-gray-500 mt-2">{formatDate(item.eventDate)}</p>
      )}
    </div>
  );
}

function KosherAlertCard({ item }: { item: KosherAlertItem }) {
  const typeColors: Record<string, string> = {
    recall: "bg-red-200 text-red-800",
    warning: "bg-orange-200 text-orange-800",
    status_change: "bg-yellow-200 text-yellow-800",
    update: "bg-blue-200 text-blue-800",
  };

  return (
    <div className="p-4 rounded-lg bg-red-50">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900">{item.productName}</h3>
        {item.alertType && (
          <Badge className={typeColors[item.alertType] || "bg-gray-200 text-gray-800"}>
            {item.alertType.replace("_", " ")}
          </Badge>
        )}
      </div>
      {item.brand && <p className="text-sm text-gray-600 mt-1">{item.brand}</p>}
      {item.certifyingAgency && (
        <p className="text-xs text-gray-500 mt-1">Agency: {item.certifyingAgency}</p>
      )}
      {item.description && (
        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
          {truncate(item.description, 120)}
        </p>
      )}
    </div>
  );
}

function BulletinAlertCard({ item }: { item: BulletinAlertItem }) {
  const urgencyColors: Record<string, string> = {
    normal: "bg-gray-200 text-gray-700",
    high: "bg-amber-200 text-amber-800",
    urgent: "bg-red-200 text-red-800",
  };

  return (
    <div className="p-4 rounded-lg bg-amber-50">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900">{item.title}</h3>
        <Badge className={urgencyColors[item.urgency] || "bg-gray-200 text-gray-700"}>
          {item.urgency}
        </Badge>
      </div>
      {item.content && (
        <p className="text-sm text-gray-600 mt-2 line-clamp-3">
          {truncate(stripHtml(item.content), 150)}
        </p>
      )}
      <p className="text-xs text-gray-500 mt-2">{formatDate(item.createdAt)}</p>
    </div>
  );
}

function ShivaCard({ item }: { item: ShivaItem }) {
  const mourners = item.mournerNames ? item.mournerNames.join(", ") : "";

  return (
    <div className="p-4 rounded-lg bg-gray-100">
      <h3 className="font-semibold text-gray-900">{item.niftarName}</h3>
      {mourners && <p className="text-sm text-gray-600 mt-1">{mourners}</p>}
      {item.shivaAddress && (
        <p className="text-sm text-gray-500 mt-1">{item.shivaAddress}</p>
      )}
      {item.shivaEnd && (
        <p className="text-xs text-gray-500 mt-1">
          Until {formatDate(item.shivaEnd)}
        </p>
      )}
    </div>
  );
}

function TehillimCard({ item }: { item: TehillimItem }) {
  return (
    <div className="p-4 rounded-lg bg-blue-50">
      {item.hebrewName ? (
        <p className="font-semibold text-gray-900" dir="rtl">
          {item.hebrewName}
          {item.motherHebrewName && (
            <span className="text-gray-600"> בן/בת {item.motherHebrewName}</span>
          )}
        </p>
      ) : (
        <p className="font-semibold text-gray-900">
          {item.englishName}
          {item.motherHebrewName && (
            <span className="text-gray-600"> ben/bat {item.motherHebrewName}</span>
          )}
        </p>
      )}
      {item.reason && <p className="text-sm text-gray-500 mt-1">{item.reason}</p>}
    </div>
  );
}

// --- Main component ---

export function CommunityCornerClient({
  askTheRabbiItems,
  simchasItems,
  kosherAlertItems,
  bulletinAlertItems,
  shivaItems,
  tehillimItems,
}: CommunityCornerClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("ask-rabbi");
  const [indices, setIndices] = useState<Record<TabKey, number>>({
    "ask-rabbi": 0,
    simchas: 0,
    "kosher-alerts": 0,
    bulletin: 0,
    shiva: 0,
    tehillim: 0,
  });

  const itemsMap: Record<TabKey, unknown[]> = {
    "ask-rabbi": askTheRabbiItems,
    simchas: simchasItems,
    "kosher-alerts": kosherAlertItems,
    bulletin: bulletinAlertItems,
    shiva: shivaItems,
    tehillim: tehillimItems,
  };

  const currentItems = itemsMap[activeTab];
  const currentIndex = indices[activeTab];
  const totalItems = currentItems.length;

  const navigate = useCallback(
    (direction: "prev" | "next") => {
      setIndices((prev) => {
        const current = prev[activeTab];
        const total = itemsMap[activeTab].length;
        if (total === 0) return prev;
        const newIndex =
          direction === "next"
            ? (current + 1) % total
            : (current - 1 + total) % total;
        return { ...prev, [activeTab]: newIndex };
      });
    },
    [activeTab, itemsMap]
  );

  // Render the current item for active tab
  function renderCurrentItem() {
    if (totalItems === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <p>No items to display.</p>
        </div>
      );
    }

    const item = currentItems[currentIndex];

    switch (activeTab) {
      case "ask-rabbi":
        return <AskRabbiCard item={item as AskRabbiItem} />;
      case "simchas":
        return <SimchaCard item={item as SimchaItem} />;
      case "kosher-alerts":
        return <KosherAlertCard item={item as KosherAlertItem} />;
      case "bulletin":
        return <BulletinAlertCard item={item as BulletinAlertItem} />;
      case "shiva":
        return <ShivaCard item={item as ShivaItem} />;
      case "tehillim":
        return <TehillimCard item={item as TehillimItem} />;
    }
  }

  // Render actions for active tab
  function renderActions() {
    switch (activeTab) {
      case "ask-rabbi":
        return <AskRabbiActions />;
      case "simchas":
        return <SimchasActions />;
      case "kosher-alerts":
        return <KosherAlertActions />;
      case "bulletin":
        return <BulletinAlertActions />;
      case "shiva":
        return <ShivaActions />;
      case "tehillim":
        return (
          <div className="mt-4 pt-4 border-t flex gap-2">
            <Link
              href="/community/tehillim/add"
              className="flex-1 inline-flex items-center justify-center rounded-md border border-input bg-transparent px-4 py-2 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Add Name
            </Link>
            <Link
              href="/community/tehillim"
              className="flex-1 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              View All →
            </Link>
          </div>
        );
    }
  }

  return (
    <Card className="border-0 shadow-md">
      {/* Tabs - 2-col grid on mobile, horizontal row on md+ */}
      <div className="p-4 pb-0">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const colors = TAB_COLORS[tab.color];
            const Icon = tab.icon;

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium
                  transition-colors cursor-pointer
                  ${isActive ? colors.active : `text-gray-600 ${colors.hover}`}
                `}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <CardContent className="pt-4">
        {/* Carousel area */}
        <div className="relative">
          {/* Prev/Next arrows */}
          {totalItems > 1 && (
            <>
              <button
                onClick={() => navigate("prev")}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 bg-white shadow-md rounded-full p-1.5 hover:bg-gray-50 transition-colors cursor-pointer"
                aria-label="Previous item"
              >
                <ChevronLeft className="h-4 w-4 text-gray-600" />
              </button>
              <button
                onClick={() => navigate("next")}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 bg-white shadow-md rounded-full p-1.5 hover:bg-gray-50 transition-colors cursor-pointer"
                aria-label="Next item"
              >
                <ChevronRight className="h-4 w-4 text-gray-600" />
              </button>
            </>
          )}

          {/* Content with padding for arrows */}
          <div className="px-4">{renderCurrentItem()}</div>
        </div>

        {/* Dot indicators */}
        {totalItems > 1 && (
          <div className="flex justify-center gap-1.5 mt-3">
            {Array.from({ length: totalItems }).map((_, i) => (
              <button
                key={i}
                onClick={() =>
                  setIndices((prev) => ({ ...prev, [activeTab]: i }))
                }
                className={`h-2 w-2 rounded-full transition-colors cursor-pointer ${
                  i === currentIndex ? "bg-gray-800" : "bg-gray-300"
                }`}
                aria-label={`Go to item ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Actions */}
        {renderActions()}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify the dev server compiles without errors**

Run: `npm run dev` and check browser at `http://localhost:3000` — the Community Corner section should render with 6 tabs and carousel navigation.

- [ ] **Step 3: Commit**

```bash
git add src/components/home/CommunityCornerClient.tsx
git commit -m "feat: create CommunityCornerClient with 6-tab carousel UI"
```

---

## Task 4: Manual testing & polish

- [ ] **Step 1: Test all 6 tabs**

Open `http://localhost:3000` and verify:
- All 6 tabs are visible (2-col grid on mobile, horizontal row on desktop)
- Clicking each tab shows the correct content type
- Prev/next arrows navigate through items
- Dot indicators update and are clickable
- "View All" links go to the correct page
- Empty state shows "No items to display." with no arrows/dots

- [ ] **Step 2: Test mobile layout**

Use browser DevTools responsive mode (375px width):
- Tabs should display as 2-column grid (3 rows × 2 tabs)
- Arrows should not overflow the card
- Content should be readable

- [ ] **Step 3: Fix any visual issues found during testing**

Common issues to watch for:
- Arrow buttons overflowing on small screens → adjust `-translate-x` values
- Tab text truncation on mobile → ensure `truncate` class is present
- Long content pushing card height → ensure `line-clamp` classes are working

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Community Corner redesign with 6-tab carousel"
```
