# Community Corner Tabs Redesign

## Overview

Expand the existing homepage Community Corner from 4 tabs to 6 tabs, and change the display pattern from a multi-item list to a one-at-a-time carousel with prev/next arrows. Matches the original FrumToronto site's "Community Corner" section.

## Tabs

| Tab | Icon | Color Accent | Links To |
|---|---|---|---|
| Ask the Rabbi | MessageSquare | Purple | `/ask-the-rabbi` |
| Simchas | Heart | Pink | `/simchas` |
| Kosher Alerts | ShieldAlert | Red/Orange | `/kosher-alerts` |
| Bulletin Alerts | Bell | Amber | `/alerts` |
| Shiva | Users | Gray | `/shiva` |
| Tehillim | BookOpen | Blue | `/community/tehillim` |

**Simchas** is a single combined tab showing all simcha types (Wedding, Birth, Engagement, Bar Mitzvah, etc.) with type badges — not split into separate tabs.

## Data Fetching

Server component fetches all 6 datasets in parallel via `Promise.all`. No new API routes needed.

### Per-Tab Queries

| Tab | Table | Filter | Order | Limit |
|---|---|---|---|---|
| Ask the Rabbi | `askTheRabbi` | `isPublished = true` | `questionNumber DESC` | 10 |
| Simchas | `simchas` + `simchaTypes` join | `isActive = true, approvalStatus = "approved"` | `createdAt DESC` | 10 |
| Kosher Alerts | `kosherAlerts` | `isActive = true, approvalStatus = "approved"` | `createdAt DESC` | 10 |
| Bulletin Alerts | `alerts` | `isActive = true, approvalStatus = "approved", (expiresAt IS NULL OR expiresAt >= now())` | `isPinned DESC, createdAt DESC` | 10 |
| Shiva | `shivaNotifications` | `approvalStatus = "approved", shivaEnd >= today` | `shivaEnd ASC` | 10 |
| Tehillim | `tehillimList` | `isActive = true, approvalStatus = "approved"` | `createdAt DESC` | 10 |

## Item Display (One at a Time)

Each tab shows one item at a time. Users browse with left/right chevron arrows.

### Ask the Rabbi
- Question number badge (purple)
- Title
- First ~100 characters of question text
- "Read More" link to `/ask-the-rabbi/[id]`

### Simchas
- Family name
- Announcement text
- Simcha type badge (Wedding/Birth/etc.)
- Event date if present

### Kosher Alerts
- Product name
- Brand
- Alert type badge (recall/warning/status_change/update)
- Certifying agency
- Description snippet

### Bulletin Alerts
- Title
- Urgency badge (normal/high/urgent)
- Content snippet (HTML stripped)
- Date

### Shiva
- Niftar name
- Mourner names (comma-separated)
- Address
- Shiva end date

### Tehillim
- Hebrew name ben/bat mother's Hebrew name
- English name fallback
- Reason

## Visual Design

- **Card container** with subtle shadow (matches current site aesthetic)
- **Pill-style tabs** — horizontal row on desktop (md+), stacked vertically on mobile (2-column grid or single column)
- Active tab gets filled pill background
- **One item at a time** centered in the card content area
- **Left/right chevron arrows** flanking the content for navigation
- **Dot indicators** at the bottom showing current position (e.g., dot 3 of 8)
- **Smooth horizontal slide animation** between items using CSS transitions with `translateX` — no additional animation libraries
- **"View All" link** at the bottom of each tab linking to the full page
- **Mobile tabs:** stacked vertically as a 2-column grid (3 rows of 2) so all 6 tabs are visible without scrolling. On `md+` breakpoint, switch to a single horizontal row
- **Date format:** Display dates as "Mon Day, Year" (e.g., "Apr 15, 2026") using `toLocaleDateString`
- **Tab index persistence:** Each tab remembers its current index independently — switching tabs and coming back preserves position

## Component Architecture

### Files

| File | Type | Action |
|---|---|---|
| `src/components/home/CommunityCornerTabs.tsx` | Server component | **Rewrite** — fetch all 6 datasets, pass as props to client |
| `src/components/home/CommunityCornerClient.tsx` | Client component | **New** — tabs, arrow nav, slide animation, dot indicators |
| `src/components/home/CommunityCornerActions.tsx` | Client component | **Update** — add actions for Kosher Alerts and Bulletin Alerts tabs |

### Per-Tab Actions (below carousel content)

| Tab | Action Button | View All Link |
|---|---|---|
| Ask the Rabbi | — | View All → `/ask-the-rabbi` |
| Simchas | — | View All → `/simchas` |
| Kosher Alerts | "Report Kosher Alert" (opens `KosherAlertSubmitModal`) | View All → `/kosher-alerts` |
| Bulletin Alerts | — | View All → `/alerts` |
| Shiva | "Report Shiva Notice" (opens `ShivaSubmitModal`) | View All → `/shiva` |
| Tehillim | "Add Name" → `/community/tehillim/add` | View All → `/community/tehillim` |

### Data Flow

```
CommunityCornerTabs (server)
  → fetches all 6 datasets via Promise.all
  → passes as props to CommunityCornerClient

CommunityCornerClient (client)
  → manages activeTab state
  → manages currentIndex per tab (independent)
  → renders pill tabs (horizontally scrollable on mobile)
  → renders one item at a time with prev/next chevron arrows
  → renders dot indicators below content
  → renders "View All" link per tab
```

### Props Interface

```typescript
interface CommunityCornerClientProps {
  askTheRabbiItems: Array<{
    id: number;
    questionNumber: number | null;
    title: string;
    question: string | null;
  }>;
  simchasItems: Array<{
    id: number;
    familyName: string;
    announcement: string | null;
    eventDate: string | null;
    typeName: string | null;
  }>;
  kosherAlertItems: Array<{
    id: number;
    productName: string;
    brand: string | null;
    alertType: string;
    certifyingAgency: string | null;
    description: string | null;
  }>;
  bulletinAlertItems: Array<{
    id: number;
    title: string;
    content: string | null;
    alertType: string;
    urgency: string;
    createdAt: string; // ISO string (Date serialized across server→client boundary)
  }>;
  shivaItems: Array<{
    id: number;
    niftarName: string;
    mournerNames: string[] | null; // JSONB array of mourner name strings
    shivaAddress: string | null;
    shivaEnd: string | null;
  }>;
  tehillimItems: Array<{
    id: number;
    hebrewName: string | null;
    englishName: string | null;
    motherHebrewName: string | null;
    reason: string | null;
  }>;
}
```

## Homepage Placement

Stays in the same position: after Quick Links/Explore section, before Featured Businesses. No changes to `src/app/page.tsx` layout needed.

## Empty States

When a tab has 0 items, show centered text: "No [content type] to display." with no arrows or dots.

## No New API Routes

All data is fetched server-side in the existing server component pattern. The client component receives pre-fetched data as props.
