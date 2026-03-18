# Admin Sidebar Reorganization

## Problem

The admin sidebar has 16 flat navigation links where related pages are scattered. Shuls, Shul Requests, and Shul Managers are three separate links. Events, Shiurim, and Classifieds are separate from the Content group. Alerts and Kosher Alerts exist as pages but aren't in the sidebar at all. Eruv Status and Important Numbers have no admin pages.

## Solution

Collapse 16 sidebar links into 10 by grouping related pages under tab-based parent routes. Build two missing admin pages (Eruv Status, Important Numbers).

## Sidebar Structure

```
Dashboard          (single page)
Users              (single page)
Shuls              → All Shuls | Requests | Managers
Businesses         → All Businesses | Categories | Plans
Programs           → Events | Shiurim | Ask the Rabbi | Classifieds | Specials
Community          → Simchas | Shiva | Tehillim | Alerts | Kosher Alerts | Eruv | Important Numbers
Approvals          (single page)
Newsletters        (single page)
Contact Messages   (single page)
Settings           (single page)
```

## Routing

Each grouped item uses URL-based tabs. The first tab is the default when clicking the sidebar link.

### Shuls Group
| Tab | Route |
|-----|-------|
| All Shuls | `/admin/shuls` |
| Requests | `/admin/shuls/requests` |
| Managers | `/admin/shuls/managers` |

**Note:** `/admin/shuls/[id]` and `/admin/shuls/[id]/davening` are detail routes that exist as children. Next.js resolves static segments (`requests`, `managers`) before dynamic segments (`[id]`), so there is no conflict. However, the shuls layout must conditionally hide tabs on detail pages — see Tab Navigation Component section.

### Businesses Group
| Tab | Route |
|-----|-------|
| All Businesses | `/admin/businesses` |
| Categories | `/admin/businesses/categories` |
| Plans | `/admin/businesses/plans` |

### Programs Group
| Tab | Route |
|-----|-------|
| Events | `/admin/programs/events` |
| Shiurim | `/admin/programs/shiurim` |
| Ask the Rabbi | `/admin/programs/rabbi` |
| Classifieds | `/admin/programs/classifieds` |
| Specials | `/admin/programs/specials` |

Default: `/admin/programs` redirects to `/admin/programs/events`.

### Community Group
| Tab | Route |
|-----|-------|
| Simchas | `/admin/community/simchas` |
| Shiva | `/admin/community/shiva` |
| Tehillim | `/admin/community/tehillim` |
| Alerts | `/admin/community/alerts` |
| Kosher Alerts | `/admin/community/kosher-alerts` |
| Eruv | `/admin/community/eruv` |
| Important Numbers | `/admin/community/important-numbers` |

Default: `/admin/community` redirects to `/admin/community/simchas`.

### Standalone Pages (no tabs)
| Page | Route |
|------|-------|
| Dashboard | `/admin` |
| Users | `/admin/users` |
| Approvals | `/admin/approvals` |
| Newsletters | `/admin/newsletters` |
| Contact Messages | `/admin/contacts` |
| Settings | `/admin/settings` |

## Route Migration Map

| Current Route | New Route |
|---------------|-----------|
| `/admin/shuls` | `/admin/shuls` (stays) |
| `/admin/shuls/[id]` | `/admin/shuls/[id]` (stays) |
| `/admin/shuls/[id]/davening` | `/admin/shuls/[id]/davening` (stays) |
| `/admin/shul-requests` | `/admin/shuls/requests` |
| `/admin/user-shuls` | `/admin/shuls/managers` |
| `/admin/businesses` | `/admin/businesses` (stays) |
| `/admin/categories` | `/admin/businesses/categories` |
| `/admin/subscription-plans` | `/admin/businesses/plans` |
| `/admin/events` | `/admin/programs/events` |
| `/admin/shiurim` | `/admin/programs/shiurim` |
| `/admin/rabbi-submissions` | `/admin/programs/rabbi` |
| `/admin/content/classifieds` | `/admin/programs/classifieds` |
| `/admin/specials` | `/admin/programs/specials` |
| `/admin/content/simchas` | `/admin/community/simchas` |
| `/admin/content/shiva` | `/admin/community/shiva` |
| `/admin/content/tehillim` | `/admin/community/tehillim` |
| `/admin/alerts` | `/admin/community/alerts` |
| `/admin/kosher-alerts` | `/admin/community/kosher-alerts` |
| `/admin/content/approvals` | `/admin/approvals` |
| *new* | `/admin/community/eruv` |
| *new* | `/admin/community/important-numbers` |

## Tab Navigation Component

Reusable `AdminTabs` component at `src/components/admin/AdminTabs.tsx`, used by all grouped pages via shared layouts.

### Props
```typescript
interface AdminTabsProps {
  tabs: { label: string; href: string }[];
}
```

### Behavior
- Renders horizontal underline-style tabs (matching current `/admin/content` pattern)
- Each tab is a Next.js `<Link>`
- Active tab matching algorithm:
  1. Exact match: `pathname === tab.href` — highest priority
  2. Nested match: `pathname.startsWith(tab.href + "/")` — for detail routes (e.g., `/admin/shuls/123` highlights "All Shuls" tab)
  3. First match wins when multiple tabs could match
- No client-side state — purely route-based
- **Desktop:** Horizontal underline tabs in a single row
- **Mobile:** Vertical stack of tab links (column layout) so all tabs are visible without horizontal scrolling. Clean pill/list style, not cramped horizontal scroll.

### Detail Page Handling

The group layouts must conditionally hide the tab bar on detail pages. For Shuls, when the path matches `/admin/shuls/[id]` or `/admin/shuls/[id]/davening`, the tabs should not render. The layout achieves this by checking the pathname:

```typescript
// In shuls/layout.tsx
const pathname = usePathname();
const isDetailPage = /^\/admin\/shuls\/\d+/.test(pathname);
// Only render AdminTabs when !isDetailPage
```

### Layout Pattern

Each group gets a Next.js layout file that renders the tabs:

```
src/app/(admin)/admin/shuls/layout.tsx       → AdminTabs with Shuls tabs (hidden on [id] routes)
src/app/(admin)/admin/businesses/layout.tsx   → AdminTabs with Businesses tabs
src/app/(admin)/admin/programs/layout.tsx     → AdminTabs with Programs tabs
src/app/(admin)/admin/community/layout.tsx    → AdminTabs with Community tabs
```

The layout renders the tab bar, and `{children}` renders the active tab's page.

## New Pages to Build

### Eruv Status (`/admin/community/eruv`)

Admin page to manage eruv status updates.

**UI:** Simple form + history table:
- Status toggle: Up / Down (boolean — `isUp` column)
- Date picker for `statusDate` (defaults to today)
- Message textarea (optional — e.g., "Damaged on north side, repair scheduled")
- Save button
- Below the form: table of recent status entries showing date, status, message, who updated

**Data:** Uses existing `eruvStatus` table:
```
id, statusDate (date, unique), isUp (boolean), message (varchar 500),
updatedBy (references users.id), updatedAt (timestamp)
```

**API:**
- `GET /api/admin/eruv` — list recent statuses
- `POST /api/admin/eruv` — create new status entry (upserts by date since statusDate is unique)
- `PATCH /api/admin/eruv/[id]` — update existing entry

### Important Numbers (`/admin/community/important-numbers`)

Admin page to manage community phone directory.

**UI:** CRUD table with inline add/edit:
- Name (text input, required)
- Phone number (text input, required)
- Description (text input, optional)
- Category (text input — varchar, free-form)
- Is Emergency (checkbox — separate `isEmergency` boolean column)
- Display Order (number input — `displayOrder` column)
- Add / Edit / Delete actions

**Data:** Uses existing `importantNumbers` table:
```
id, category (varchar 100), name (varchar 200), phone (varchar 50),
description (varchar 500), isEmergency (boolean), displayOrder (integer)
```

**API:**
- `GET /api/admin/important-numbers` — list all, ordered by displayOrder
- `POST /api/admin/important-numbers` — create
- `PATCH /api/admin/important-numbers/[id]` — update
- `DELETE /api/admin/important-numbers/[id]` — delete

## Sidebar Component Changes

Update `AdminLayoutClient.tsx` navItems array from 16 flat items to 10 grouped items.

```typescript
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

Active state logic: For Dashboard, use exact match (`pathname === "/admin"`). For all others, use `pathname.startsWith(item.href)`. This means `/admin/programs/events` highlights "Programs", `/admin/shuls/123/davening` highlights "Shuls", etc.

## Hardcoded Admin Links to Update

These files reference old admin routes in email templates or navigation and must be updated:

| File | Old Link | New Link |
|------|----------|----------|
| `src/app/api/community/shiva/route.ts:149` | `/admin/content/shiva` | `/admin/community/shiva` |
| `src/app/api/community/tehillim/route.ts:133` | `/admin/content` | `/admin/community/tehillim` |
| `src/app/(admin)/admin/page.tsx:90` | `/admin/content?status=pending` | `/admin/approvals` |
| `src/app/(admin)/admin/page.tsx:105` | `/admin/content?type=classifieds&status=pending` | `/admin/approvals` |

## Files to Delete After Migration

These old page directories are deleted after their contents are moved to new locations:

- `src/app/(admin)/admin/shul-requests/` → moved to `/admin/shuls/requests`
- `src/app/(admin)/admin/user-shuls/` → moved to `/admin/shuls/managers`
- `src/app/(admin)/admin/categories/` → moved to `/admin/businesses/categories`
- `src/app/(admin)/admin/subscription-plans/` → moved to `/admin/businesses/plans`
- `src/app/(admin)/admin/events/` → moved to `/admin/programs/events`
- `src/app/(admin)/admin/specials/` → moved to `/admin/programs/specials`
- `src/app/(admin)/admin/alerts/` → moved to `/admin/community/alerts`
- `src/app/(admin)/admin/kosher-alerts/` → moved to `/admin/community/kosher-alerts`
- `src/app/(admin)/admin/content/` → pieces distributed to Programs, Community, and Approvals
- `src/app/(admin)/admin/rabbi-submissions/` → moved to `/admin/programs/rabbi`

## API Routes

Existing API routes under `/api/admin/` do NOT move. Only the frontend page files are reorganized. The page components continue to call the same API endpoints (e.g., the events page at its new location still calls `/api/admin/events`).

## Unchanged Pages

These pages stay exactly where they are with no modifications:
- `/admin` (Dashboard — only hardcoded links updated)
- `/admin/users`
- `/admin/newsletters` (and sub-routes)
- `/admin/contacts`
- `/admin/settings`
