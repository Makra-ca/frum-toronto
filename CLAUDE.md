# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Frum Toronto** is a comprehensive Jewish community platform for Toronto's Orthodox community. It serves as a central hub providing:

- **Business Directory** - Kosher businesses with categories, hours, certifications
- **Shul Management** - Synagogues with davening schedules, managed by assigned users
- **Events & Calendar** - Community events with approval workflow
- **Shiurim** - Torah classes with flexible scheduling, teacher info, location areas
- **Classifieds** - Buy/sell listings with categories
- **Community Features** - Simchas, shiva notifications, tehillim list, kosher alerts, eruv status
- **Ask the Rabbi** - Q&A system with numbered questions
- **Newsletter System** - Batch email sending with open/click tracking
- **Zmanim** - Halachic times for Toronto

---

## Commands

```bash
# Development
npm run dev              # Start dev server with Turbopack (port 3000)
npm run build            # Production build with Turbopack
npm run lint             # Run ESLint

# Database (Drizzle + Neon PostgreSQL)
npm run db:push          # Push schema changes directly (use for dev)
npm run db:generate      # Generate migration files
npm run db:migrate       # Run migrations
npm run db:studio        # Open Drizzle Studio GUI (visual DB browser)
npm run db:check         # Run custom database check script
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 with App Router, Turbopack |
| Database | Neon PostgreSQL (serverless) with Drizzle ORM |
| Auth | NextAuth v5 (beta) with JWT strategy |
| Email | Resend (batch API for newsletters) |
| Storage | Vercel Blob |
| Payments | PayPal (subscriptions), Stripe (legacy) |
| UI | Tailwind CSS v4, Radix UI, shadcn/ui |
| Forms | react-hook-form + Zod validation |
| Rich Text | TipTap editor |
| Calendar | @hebcal/core (zmanim calculations) |
| Icons | lucide-react |

---

## Project Structure

```
src/
├── app/
│   ├── (admin)/admin/       # Admin panel (role="admin" required)
│   │   ├── shuls/           # All Shuls | Requests | Managers (tabbed)
│   │   ├── businesses/      # All Businesses | Categories | Plans (tabbed)
│   │   ├── programs/        # Events | Shiurim | Rabbi | Classifieds | Specials (tabbed)
│   │   ├── community/       # Simchas | Shiva | Tehillim | Alerts | Eruv | Numbers (tabbed)
│   │   ├── approvals/       # Content approval queue
│   │   └── ...              # users, newsletters, contacts, settings
│   ├── (auth)/              # Auth pages (login, register, forgot-password)
│   ├── (dashboard)/dashboard/ # User dashboard (authenticated)
│   ├── (public)/            # Public pages (shuls, shiurim, calendar, zmanim)
│   ├── api/                 # API routes
│   │   ├── admin/           # Admin-only endpoints
│   │   ├── auth/            # Auth endpoints (register, reset-password)
│   │   ├── cron/            # Vercel cron jobs
│   │   └── newsletter/      # Newsletter tracking endpoints
│   └── newsletter/          # Public newsletter pages (unsubscribe, preferences)
│
├── components/
│   ├── admin/               # Admin components (forms, tables, sidebar)
│   ├── layout/              # Header, Footer, LayoutWrapper
│   ├── newsletter/          # TipTap editor components
│   ├── providers/           # SessionProvider
│   └── ui/                  # shadcn/ui components
│
├── lib/
│   ├── auth/                # NextAuth config + permissions helpers
│   │   ├── auth.ts          # Main NextAuth config with JWT callbacks
│   │   ├── auth.config.ts   # Route authorization (middleware)
│   │   └── permissions.ts   # Shul management permission checks
│   ├── db/
│   │   ├── index.ts         # Drizzle client initialization
│   │   └── schema.ts        # All table definitions
│   ├── email/
│   │   ├── resend.ts        # Resend client
│   │   ├── send.ts          # Email sending functions
│   │   ├── templates.ts     # HTML email templates
│   │   └── newsletter-template.ts # Newsletter HTML with tracking
│   ├── validations/
│   │   ├── content.ts       # Zod schemas for shuls, events, businesses, etc.
│   │   └── newsletter.ts    # Newsletter validation schemas
│   └── zmanim.ts            # Halachic times calculation
│
└── types/
    ├── index.ts             # Main type definitions
    ├── content.ts           # Content-specific types
    ├── newsletter.ts        # Newsletter types
    └── next-auth.d.ts       # NextAuth type augmentation
```

---

## Database Schema

Schema location: `src/lib/db/schema.ts`

### Entity Groups

**Users & Auth:**
- `users` - User accounts with roles (admin, shul, business, content_contributor, member)
- `accounts` - OAuth provider accounts (NextAuth)
- `sessions` - User sessions (NextAuth)
- `verificationTokens` - Email verification (NextAuth)
- `passwordResetTokens` - Password reset flow

**Business Directory:**
- `businessCategories` - Hierarchical categories with parentId
- `businesses` - Listings with hours (JSONB), kosher certification, approval status
- `businessPhotos` - Photo gallery for businesses
- `subscriptionPlans` - Stripe subscription tiers
- `businessSubscriptions` - Active subscriptions

**Shuls:**
- `shuls` - Synagogue info (rabbi, denomination, nusach)
- `daveningSchedules` - Prayer times by day, season, tefilah type
- `userShuls` - Manager assignments (userId ↔ shulId)
- `shulRegistrationRequests` - Users requesting to manage a shul

**Content:**
- `events` - Community events with startTime, endTime, eventType
- `shiurim` - Torah classes with flexible schedule (JSONB), teacher info
- `classifieds` - Buy/sell listings
- `classifiedCategories` - Classified categories
- `askTheRabbi` - Q&A with questionNumber

**Community:**
- `simchas` - Birth, engagement, wedding announcements
- `simchaTypes` - Simcha type definitions
- `shivaNotifications` - Shiva info with mourner names (JSONB)
- `tehillimList` - Prayer requests
- `alerts` - General community alerts
- `kosherAlerts` - Product recalls, status changes
- `eruvStatus` - Daily eruv status

**Newsletter:**
- `newsletters` - Newsletter content (HTML + TipTap JSON)
- `newsletterSegments` - Subscriber segments with filterCriteria (JSONB)
- `newsletterSends` - Send operations with stats (openCount, clickCount)
- `newsletterRecipientLogs` - Per-recipient tracking
- `emailSubscribers` - Subscribers with preferences, unsubscribeToken

**Other:**
- `contactSubmissions` - Contact form submissions
- `importantNumbers` - Emergency/community phone numbers

### JSONB Patterns

```typescript
// Business hours
hours: { sunday: { open: "09:00", close: "17:00" }, monday: {...}, ... }

// Shiur schedule (keyed by day 0-6)
schedule: { "0": { start: "09:00", end: "10:00", notes: "" }, "1": {...}, ... }

// Social links
socialLinks: { facebook: "url", instagram: "url", ... }

// Newsletter filter criteria
filterCriteria: { newsletter: true, kosherAlerts: false, simchas: true, ... }
```

---

## Authentication

### NextAuth Configuration

Location: `src/lib/auth/auth.ts`

**Providers:**
- Google OAuth
- Email/password credentials

**JWT Strategy:**
The project uses JWT sessions (not database sessions). The JWT callbacks are critical:

```typescript
// jwt callback - adds custom fields to token
async jwt({ token, user }) {
  if (user) {
    token.id = user.id;
    // IMPORTANT: Fetch role from DB for OAuth users
    const dbUser = await db.select(...).from(users).where(...);
    token.role = dbUser?.role || "member";
    token.isTrusted = dbUser?.isTrusted ?? false;
  }
  return token;
}

// session callback - copies token to session
async session({ session, token }) {
  session.user.id = token.id;
  session.user.role = token.role;
  session.user.isTrusted = token.isTrusted;
  return session;
}
```

### User Roles

| Role | Access |
|------|--------|
| `admin` | Full access, all admin routes |
| `shul` | Manage assigned shuls only |
| `business` | Manage own business listings |
| `content_contributor` | Submit content (events, etc.) |
| `member` | Basic user, submit classifieds |

### Route Protection

**Middleware** (`src/lib/auth/auth.config.ts`):
- `/admin/*` → Requires `role === "admin"`
- `/dashboard/*` → Requires authentication

**Server-side pattern** (API routes):
```typescript
const session = await auth();
if (!session?.user || session.user.role !== "admin") {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### Shul Permissions

Users with `role: "shul"` can only manage shuls they're assigned to via `userShuls` table.

```typescript
import { canUserManageShul } from "@/lib/auth/permissions";

const canManage = await canUserManageShul(userId, shulId, userRole);
```

---

## API Patterns

### Standard Response Structure

```typescript
// Success with data
return NextResponse.json({ data, pagination });

// Success with entity
return NextResponse.json(entity, { status: 201 });

// Error
return NextResponse.json({ error: "Human-readable message" }, { status: 400 });
```

### Pagination Pattern

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;

  // Get count
  const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(table);
  const totalCount = Number(countResult?.count || 0);

  // Get data
  const data = await db.select().from(table).limit(limit).offset(offset);

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      hasMore: page < totalPages,
    },
  });
}
```

### Dynamic Route Parameters

**IMPORTANT:** In Next.js 15+, params are async:

```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;  // Must await!
  // ...
}
```

### Filtering Pattern

```typescript
const conditions = [];

if (status && status !== "all") {
  conditions.push(eq(table.status, status));
}

if (search?.trim()) {
  const searchTerm = `%${search.trim()}%`;
  conditions.push(or(
    ilike(table.name, searchTerm),
    ilike(table.email, searchTerm)
  ));
}

const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

const results = await db.select().from(table).where(whereClause);
```

### Slug Generation

```typescript
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function getUniqueSlug(baseName: string): Promise<string> {
  let slug = generateSlug(baseName);
  let counter = 1;

  while (true) {
    const existing = await db.select().from(table).where(eq(table.slug, slug)).limit(1);
    if (existing.length === 0) return slug;
    slug = `${generateSlug(baseName)}-${counter++}`;
  }
}
```

---

## Validation Schemas

Location: `src/lib/validations/`

### Pattern

```typescript
import { z } from "zod";

export const entitySchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email().max(255).optional().nullable().or(z.literal("")),
  isActive: z.boolean().default(true),
  hours: z.object({
    sunday: z.object({ open: z.string(), close: z.string() }).nullable().optional(),
    // ...
  }).optional().nullable(),
});

export type EntityFormData = z.infer<typeof entitySchema>;
```

### Validation in API Routes

```typescript
const body = await request.json();
const result = entitySchema.safeParse(body);

if (!result.success) {
  return NextResponse.json(
    { error: result.error.issues[0].message },
    { status: 400 }
  );
}

const validatedData = result.data;
```

### Helper Constants

The validation files export constants for dropdowns:

```typescript
export const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  // ...
];

export const TEFILAH_TYPES = [
  { value: "shacharis", label: "Shacharis" },
  { value: "mincha", label: "Mincha" },
  { value: "maariv", label: "Maariv" },
];

export const DENOMINATIONS = [
  { value: "orthodox", label: "Orthodox" },
  { value: "modern-orthodox", label: "Modern Orthodox" },
  // ...
];
```

---

## Layout Architecture

### Root Layout Flow

```
RootLayout (src/app/layout.tsx)
└── SessionProvider
    └── LayoutWrapper (client component)
        ├── /admin routes → {children} only (no Header/Footer)
        └── Other routes → Header + {children} + Footer
```

### Admin Layout

The admin area has its own layout hierarchy:

```
(admin)/admin/layout.tsx (server component)
├── Checks auth(), redirects if not admin
└── AdminLayoutClient (client component)
    ├── Desktop sidebar (hidden on mobile)
    ├── Mobile header with hamburger menu
    ├── Sheet sidebar for mobile
    ├── AdminHeader
    ├── {children}
    └── Toaster (sonner)
```

---

## Component Patterns

### Form Components

```typescript
interface EntityFormProps {
  initialData?: EntityFormData;
  onSubmit: (data: EntityFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function EntityForm({ initialData, onSubmit, onCancel, isLoading }: EntityFormProps) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<EntityFormData>({
    resolver: zodResolver(entitySchema),
    defaultValues: initialData || { /* defaults */ },
  });

  // Fetch related data
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    fetch("/api/admin/categories").then(res => res.json()).then(setCategories);
  }, []);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  );
}
```

### Client Component Pattern

```typescript
"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // ...
}
```

---

## Email System

### Resend Configuration

Location: `src/lib/email/resend.ts`

```typescript
import { Resend } from "resend";

export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export const EMAIL_FROM = process.env.EMAIL_FROM || "FrumToronto <noreply@frumtoronto.com>";
```

### Sending Pattern

```typescript
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!resend) {
    console.error("Resend client not initialized");
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Failed to send:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error sending:", error);
    return false;
  }
}
```

### Newsletter Batch Sending

The newsletter system handles 5-7k subscribers via batch processing:

1. Admin initiates send → Creates `newsletterSends` + `newsletterRecipientLogs` entries
2. Cron job runs every minute (`vercel.json`)
3. Processes 500 emails per run (5 batches × 100 emails)
4. Uses Resend batch API with rate limiting

```typescript
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/newsletter-send",
      "schedule": "* * * * *"
    }
  ]
}
```

### Email Templates

- Use table-based layouts for email client compatibility
- Inline CSS styles (not external stylesheets)
- Dynamic year: `new Date().getFullYear()` (never hardcoded)
- Include unsubscribe link with token

---

## Content Approval Workflow

User-submitted content has `approvalStatus` field:

| Status | Description |
|--------|-------------|
| `pending` | Awaiting admin review |
| `approved` | Published/visible |
| `rejected` | Not approved |

**Trusted users** (`isTrusted: true` on users table) skip the approval queue.

Admin-created content is auto-approved:
```typescript
approvalStatus: "approved", // Admin-created
```

---

## Environment Variables

Required variables (see `.env.example`):

```bash
# Database
DATABASE_URL=postgres://...@host.neon.tech/neondb?sslmode=require

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Email
RESEND_API_KEY=re_...
EMAIL_FROM="FrumToronto <noreply@frumtoronto.com>"

# Storage
BLOB_READ_WRITE_TOKEN=...

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...

# Weather
OPENWEATHER_API_KEY=...

# Cron (production)
CRON_SECRET=... # Protects cron endpoints

# App URL
NEXT_PUBLIC_APP_URL=https://frumtoronto.com

# Cloudflare Turnstile — bot defence on /register
# Widget: Cloudflare dashboard -> Application security -> Turnstile ->
# "Add widget manually". Hostnames: www.frumtoronto.com, frumtoronto.com,
# localhost. Mode: Managed.
# Unset -> the widget does not render and the server SKIPS verification
# outside production; in production a missing secret returns 503 rather than
# letting signups through.
NEXT_PUBLIC_TURNSTILE_SITE_KEY=   # public, ships to the browser
TURNSTILE_SECRET_KEY=             # server only — never prefix this NEXT_PUBLIC_
```

---

## Naming Conventions

| Category | Convention | Example |
|----------|------------|---------|
| Files (components) | PascalCase | `BusinessForm.tsx` |
| Files (utilities) | camelCase | `utils.ts` |
| API routes | lowercase | `route.ts` |
| DB columns | snake_case | `created_at` |
| DB tables | plural | `businesses` |
| Event handlers | handle* | `handleSubmit` |
| Fetchers | fetch* | `fetchCategories` |
| Types | PascalCase | `BusinessFormData` |
| Constants | UPPER_SNAKE | `DAYS_OF_WEEK` |

---

## Debug Logging

Pattern used throughout:

```typescript
console.log("[AUTH DEBUG] jwt callback - trigger:", trigger);
console.log("[API] Error fetching businesses:", error);
```

Use `[CONTEXT]` prefix for easy filtering.

---

## Zmanim (Halachic Times)

Location: `src/lib/zmanim.ts`

Uses `@hebcal/core` library with Toronto coordinates hardcoded (43.65, -79.38).

Returns times for:
- Alot HaShachar, Misheyakir, Sunrise
- Sof Zman Shma, Sof Zman Tefilla
- Chatzot, Mincha Gedola, Mincha Ketana, Plag HaMincha
- Sunset, Tzait, Tzait 72
- Candle lighting, Havdalah (when applicable)

---

## PayPal Integration

### Overview

Business subscriptions are handled via PayPal Subscriptions API. The system supports:
- Multiple subscription tiers (Free, Standard, Premium, etc.)
- Monthly and yearly billing cycles
- Sandbox and live environments
- Automatic plan syncing from admin panel

### Environment Variables

```bash
# Mode: sandbox or live
PAYPAL_MODE=sandbox

# Sandbox credentials
PAYPAL_SANDBOX_CLIENT_ID=...
PAYPAL_SANDBOX_CLIENT_SECRET=...
PAYPAL_SANDBOX_WEBHOOK_ID=...

# Live credentials
PAYPAL_LIVE_CLIENT_ID=...
PAYPAL_LIVE_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID_VERCEL=...      # For frum-toronto.vercel.app
PAYPAL_WEBHOOK_ID_PRODUCTION=...  # For www.frumtoronto.com

# Active webhook (set based on current deployment)
PAYPAL_WEBHOOK_ID=...
```

**Note:** PayPal Product IDs are stored in the `site_settings` database table (not .env) and managed automatically.

### Payment Flow

1. User selects a paid plan during business registration
2. Business created with `approvalStatus: "pending_payment"`
3. User redirected to PayPal for payment
4. On success: PayPal sends webhook → status changes to `pending` (awaiting admin approval)
5. On cancel: User can retry payment from dashboard

### Key Files

| Purpose | File |
|---------|------|
| PayPal config & helpers | `src/lib/paypal/config.ts` |
| Webhook handler | `src/app/api/paypal/webhook/route.ts` |
| Create subscription | `src/app/api/paypal/create-subscription/route.ts` |
| Sync plans to PayPal | `src/app/api/admin/subscription-plans/sync-paypal/route.ts` |
| Admin subscription plans | `src/app/(admin)/admin/subscription-plans/page.tsx` |
| Payment page | `src/app/(dashboard)/dashboard/business/[id]/payment/page.tsx` |
| Success page | `src/app/(dashboard)/dashboard/business/[id]/subscription-success/page.tsx` |
| Cancel page | `src/app/(dashboard)/dashboard/business/[id]/subscription-cancelled/page.tsx` |

### Database Schema

**subscriptionPlans** - Plan definitions with PayPal Plan IDs:
- `paypalPlanIdMonthly` / `paypalPlanIdYearly` - Live plan IDs
- `paypalPlanIdMonthlySandbox` / `paypalPlanIdYearlySandbox` - Sandbox plan IDs

**businessSubscriptions** - Active subscriptions:
- `paypalSubscriptionId` - PayPal's subscription ID
- `status` - pending, active, suspended, cancelled, expired
- `billingCycle` - monthly or yearly

**siteSettings** - Key-value store for:
- `paypal_sandbox_product_id` - Sandbox product ID
- `paypal_live_product_id` - Live product ID

### Webhook Events Handled

| Event | Action |
|-------|--------|
| `BILLING.SUBSCRIPTION.ACTIVATED` | Mark subscription active, change business to `pending` |
| `BILLING.SUBSCRIPTION.CANCELLED` | Mark cancelled, downgrade to free plan |
| `BILLING.SUBSCRIPTION.SUSPENDED` | Mark suspended (payment failed) |
| `BILLING.SUBSCRIPTION.EXPIRED` | Mark expired, downgrade to free plan |
| `BILLING.SUBSCRIPTION.PAYMENT.FAILED` | Log payment failure |
| `BILLING.SUBSCRIPTION.RE-ACTIVATED` | Restore active status |
| `BILLING.SUBSCRIPTION.UPDATED` | Handle plan changes |
| `PAYMENT.SALE.COMPLETED` | Extend subscription end date |

### Admin: Syncing Plans to PayPal

1. Go to **Admin → Subscription Plans**
2. Click **"Sync to PayPal"**
3. System automatically:
   - Creates PayPal product (if needed)
   - Creates plans for each paid tier (monthly & yearly)
   - Stores plan IDs in database
4. When switching to live mode, change `PAYPAL_MODE=live` and sync again

### Adding New Plans

1. Click **"Add Plan"** in admin
2. Set name, pricing, features
3. Save the plan
4. Click **"Sync to PayPal"** to create corresponding PayPal plans

---

## Key Files Reference

| Purpose | File |
|---------|------|
| Root layout | `src/app/layout.tsx` |
| NextAuth config | `src/lib/auth/auth.ts` |
| Middleware auth | `src/lib/auth/auth.config.ts` |
| DB schema | `src/lib/db/schema.ts` |
| DB client | `src/lib/db/index.ts` |
| Admin layout | `src/app/(admin)/admin/layout.tsx` |
| Admin sidebar | `src/components/admin/AdminLayoutClient.tsx` |
| Admin tabs | `src/components/admin/AdminTabs.tsx` |
| Validation schemas | `src/lib/validations/content.ts` |
| Type definitions | `src/types/index.ts` |
| Email sending | `src/lib/email/send.ts` |
| Newsletter cron | `src/app/api/cron/newsletter-send/route.ts` |
| PayPal config | `src/lib/paypal/config.ts` |
| Zmanim calc | `src/lib/zmanim.ts` |

---

## Common Gotchas

1. **Await params in dynamic routes** - Next.js 15+ requires `const { id } = await params`

2. **OAuth role issue** - OAuth users get `role: "member"` from profile(). The JWT callback must fetch the actual role from the database.

3. **Admin route double-render** - Don't add Header/Footer in admin routes; `LayoutWrapper` excludes them based on pathname.

4. **Resend not initialized** - Always check `if (!resend)` before sending emails.

5. **JSONB columns** - Cast properly when querying: `hours`, `schedule`, `socialLinks`, `filterCriteria`.

6. **Slug uniqueness** - Always use `getUniqueSlug()` pattern to avoid conflicts.

7. **Copyright year** - Always use `new Date().getFullYear()` in footers, never hardcode.

8. **Newsletter userId requirement** - Only subscribers with `userId` in `emailSubscribers` table receive emails. Admin-added subscribers without linked accounts won't receive newsletters.

---

## Session Notes

### 2026-02-22 - Notification Preferences System

**Summary:** Implemented user-based notification system where only registered users receive emails.

**Key Changes:**

1. **Database Schema (`src/lib/db/schema.ts`)**
   - Added `userId` column to `emailSubscribers` to link with user accounts
   - Added `tehillim` and `communityEvents` boolean columns
   - Users must have `userId` to receive any emails

2. **Registration Flow**
   - Updated `src/lib/validations/auth.ts` - Added notifications object to registerSchema
   - Updated `src/components/auth/RegisterForm.tsx` - Added notification preference checkboxes
   - Updated `src/app/api/auth/register/route.ts` - Creates linked emailSubscriber record on registration

3. **User Dashboard Settings**
   - Created `src/app/(dashboard)/dashboard/settings/page.tsx` - Settings page with toggle switches
   - Created `src/app/api/user/notification-preferences/route.ts` - GET/PATCH preferences API

4. **Newsletter System Updates**
   - Updated `src/app/api/admin/newsletters/[id]/send/route.ts` - Added `isNotNull(emailSubscribers.userId)` filter
   - Updated filter criteria to include tehillim and communityEvents options
   - Admin subscribers page shows "Linked" vs "No Account" badges

5. **Other Updates**
   - Updated FAQ with new signup flow documentation
   - Updated newsletter preferences page (`/newsletter/preferences`) with new options
   - Updated unsubscribe API to include new fields
   - Updated types (`src/types/newsletter.ts`) and validation schemas

**Architecture Decision:** Only registered users receive emails (Option A). Existing email subscribers without accounts will not receive emails until they create an account. This ensures all recipients have a userId linked for proper tracking and preference management.

**Future Tasks:**
- Add notification type dropdown to newsletter composer for sending targeted emails

---

### 2026-02-22 - Business Subscription & Payment System

**Summary:** Implemented comprehensive business subscription system with tiered plans, PayPal integration (structure), and feature-gated displays.

**Subscription Tiers:**
- **Free**: Name, Address, Phone, 1 Category, 0 Photos
- **Standard ($25/mo or $240/yr)**: + Description, Contact Name, Email, Website, Hours, Map, Logo, 3 Categories, 3 Photos
- **Premium ($65/mo or $650/yr)**: + Social Links, Kosher Badge, Featured Placement, Priority Search, 5 Categories, Unlimited Photos

**Key Changes:**

1. **Database Schema (`src/lib/db/schema.ts`)**
   - Updated `subscriptionPlans` with feature toggles (showDescription, showEmail, showWebsite, showHours, showMap, showLogo, showSocialLinks, showKosherBadge, isFeatured, priorityInSearch)
   - Added PayPal fields: `paypalPlanIdMonthly`, `paypalPlanIdYearly`
   - Updated `businesses` with `subscriptionPlanId`, `additionalCategoryIds`, `contactName`
   - Updated `businessSubscriptions` for PayPal instead of Stripe
   - Migration script: `scripts/apply-business-schema.ts`

2. **Admin Subscription Plans Page**
   - `src/app/(admin)/admin/subscription-plans/page.tsx` - View/edit all plans
   - `src/app/api/admin/subscription-plans/route.ts` - GET all plans
   - `src/app/api/admin/subscription-plans/[id]/route.ts` - GET/PUT individual plan
   - Admin can change pricing, features, PayPal plan IDs

3. **PayPal Integration Structure (`src/lib/paypal/`)**
   - `config.ts` - PayPal REST API helpers (getAccessToken, createSubscription, cancelSubscription, etc.)
   - `src/app/api/paypal/create-subscription/route.ts` - Create subscription
   - `src/app/api/paypal/webhook/route.ts` - Handle PayPal webhooks
   - `src/app/api/paypal/subscription-status/route.ts` - Get status
   - `src/app/api/paypal/cancel-subscription/route.ts` - Cancel subscription
   - Env vars needed: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`, `PAYPAL_WEBHOOK_ID`

4. **Business Registration Flow**
   - `src/app/(dashboard)/dashboard/business/new/page.tsx` - Multi-step registration with plan selection
   - `src/app/api/businesses/create/route.ts` - User-facing business creation API
   - `src/app/api/subscription-plans/route.ts` - Public endpoint for pricing display
   - Updated `/register-business` to show pricing and redirect logged-in users

5. **Dashboard Upgrade Prompts**
   - Updated `src/app/(dashboard)/dashboard/page.tsx` - Shows upgrade banner for free plan users
   - Updated `src/app/(dashboard)/dashboard/business/page.tsx` - Shows plan badges and upgrade prompts
   - Updated `src/app/api/businesses/my-businesses/route.ts` - Returns plan info

6. **Feature-Gated Business Display**
   - Updated `src/app/directory/business/[slug]/page.tsx` - Conditionally shows features based on plan:
     - Logo only shown if `showLogo`
     - Description only shown if `showDescription`
     - Email only shown if `showEmail`
     - Website only shown if `showWebsite`
     - Business hours only shown if `showHours`
     - Map only shown if `showMap`
     - Kosher badge only shown if `showKosherBadge`

7. **Trusted Business Owner Auto-Approval**
   - Already implemented via `isTrusted` flag on users table
   - Admin can toggle in Users management page
   - Business creation API auto-approves submissions from trusted users

**Payment Flow:**
1. User selects plan → 2. If paid, redirects to PayPal → 3. PayPal webhook activates subscription → 4. User fills business form → 5. Submitted for review (unless trusted)

**Environment Variables Added:**
```
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox  # or "live"
PAYPAL_WEBHOOK_ID=
```

**Future Tasks:**
- Configure actual PayPal plan IDs in admin once PayPal developer account is set up
- Add photo upload functionality with plan limits enforcement
- Add subscription management UI for users to cancel/upgrade

---

## Session: 2026-02-22 - Shiva System & Per-Field Auto-Approve Permissions

### Per-Field Auto-Approve Permissions

Replaced global `isTrusted` with granular per-content-type permissions on users table:

```typescript
canAutoApproveShiva, canAutoApproveTehillim, canAutoApproveBusinesses,
canAutoApproveAskTheRabbi, canAutoApproveKosherAlerts, canAutoApproveShuls,
canAutoApproveSimchas, canAutoApproveEvents, canAutoApproveClassifieds
```

- Migration: `scripts/add-user-permissions.ts`
- Admin UI: Updated `UserTable.tsx` with permissions dialog (shield icon button)
- API: Updated `/api/admin/users/[id]/route.ts` to handle new fields

### Shiva Submission System

**Public Page:** `/shiva`
- Displays approved shiva notices (where `shivaEnd >= today`)
- "Report Shiva Notice" button opens modal (login required)
- Link to Tehillim list

**Components:**
- `src/components/shiva/ShivaSubmitModal.tsx` - Submission form modal

**APIs:**
- `POST /api/community/shiva` - Submit notice (checks `canAutoApproveShiva`)
- `GET /api/community/shiva` - List active approved notices
- `GET /api/admin/shiva` - Admin list with filters
- `GET/PATCH/DELETE /api/admin/shiva/[id]` - Admin CRUD

**Admin:**
- `/admin/content/shiva` - Management page with quick approve, edit, delete
- Added "Shiva" tab to content layout

### Navigation Updates
- Added Tehillim to Alerts dropdown
- Added Tehillim link button on Shiva page header

---

## Session: 2026-02-23 - Calendar Events Migration & Event Detail Redesign

### Calendar Events Migration from Legacy MSSQL

Migrated calendar events from the old FrumToronto MSSQL database (`Diary` table) to the new PostgreSQL `events` table.

**Migration Script:** `scripts/migrate-events.js`

**Requirements:**
```bash
npm install mssql pg --save-dev
```

**Environment Variables Needed:**
```bash
MSSQL_USER=sa
MSSQL_PASSWORD=...
MSSQL_SERVER=localhost
MSSQL_PORT=1433
DATABASE_URL=postgres://...
```

**Category Mapping (old → new):**
| Old Category ID | Old Name | New Event Type |
|-----------------|----------|----------------|
| 16 | Community Events | `community` |
| 9 | Fundraising Events | `fundraising` |
| 11 | Community School Information | `school` |
| 17 | Weddings | `wedding` |

**Skipped Categories:**
- Community Lectures (Category 4)
- Shiurim (Category 3)
- Video Presentations (Category 13)

**Key Features:**
- Only migrates future events (from today onwards)
- Converts OLE/Excel dates (days since 1899-12-30) to JavaScript Dates
- Parses time strings like "7:30 P.M." or "6:00pm - 10:00pm"
- Stores `old_id` to prevent duplicate migrations
- Skips already migrated events on re-run
- Location built from venue name + address or OtherLocation field

**Run Migration:**
```bash
node scripts/migrate-events.js
```

**Results:** 44 future events successfully migrated.

### Event Types Update

Updated `src/lib/validations/content.ts`:

```typescript
export const EVENT_TYPES = [
  { value: "community", label: "Community Event" },
  { value: "fundraising", label: "Fundraising Event" },
  { value: "school", label: "School Information" },
  { value: "wedding", label: "Wedding" },
];

eventType: z.enum(["community", "fundraising", "school", "wedding"]).optional().nullable(),
```

### Test Events

Added test events with `[TEST]` prefix for development:
- 16 basic test events across all 4 event types
- 4 detailed realistic test events with full descriptions, locations, contact info, and costs

**Clean Up Test Events:**
```sql
DELETE FROM events WHERE title LIKE '[TEST]%';
```

### Event Detail Page Redesign

Completely redesigned `src/app/(public)/community/calendar/[id]/page.tsx`:

**New Design Features:**
- Blue gradient header at top with decorative blur effects
- White card floating over header with shadow
- Date box with day number and month
- Event type badge (colored by type: blue/community, green/fundraising, amber/school, pink/wedding)
- Hebrew date display using `@hebcal/core`
- Two-column layout: main content (description, location) + sidebar (cost, contact, date/time)
- Subtle gradients on cards for visual interest
- Google Maps link for location

### EventActions Component

Created `src/components/calendar/EventActions.tsx` - Client component for event actions:

**Features:**
- **Add to Calendar** dropdown:
  - Google Calendar - Opens Google Calendar with pre-filled event details
  - Download .ics - Downloads ICS file compatible with Outlook, Apple Calendar, etc.
- **Share** button:
  - Uses Web Share API on mobile (native share sheet)
  - Falls back to clipboard copy on desktop
  - Shows toast notification on success

**Google Calendar URL Generation:**
- Handles all-day events (date-only format)
- Handles timed events with start/end
- Defaults to 2-hour duration if no end time
- Includes location and description

**ICS File Generation:**
- VCALENDAR format with VEVENT
- Proper date formatting (DTSTART/DTEND)
- Unique UID per event

### Files Modified/Created

| File | Change |
|------|--------|
| `scripts/migrate-events.js` | New - Migration script |
| `scripts/explore-events-data.js` | New - Data exploration script |
| `src/lib/validations/content.ts` | Updated EVENT_TYPES |
| `src/app/(public)/community/calendar/page.tsx` | Fixed event links to `/community/calendar/[id]` |
| `src/app/(public)/community/calendar/[id]/page.tsx` | Complete redesign |
| `src/components/calendar/EventActions.tsx` | New - Add to calendar + share buttons |

---

## Session: 2026-02-24 - Community & Kosher Alerts System

### Newsletter Form Select Fix

Fixed Radix UI Select component crash on newsletter send page (`/admin/newsletters/[id]?send=true`).

**Issue:** Radix UI `<SelectItem>` cannot have `value=""` (empty string).

**Fix in `NewsletterForm.tsx`:**
```typescript
// Changed from value="" to value="all" and convert back in onChange
<Select value={selectedSegmentId || "all"} onValueChange={(val) => setSelectedSegmentId(val === "all" ? "" : val)}>
  <SelectItem value="all">All newsletter subscribers</SelectItem>
  ...
</Select>
```

### Community Alerts Notification Preference

Added `communityAlerts` boolean field to `emailSubscribers` table for general community alert notifications.

**Files Updated:**
- `src/lib/db/schema.ts` - Added `communityAlerts` column
- `src/lib/validations/auth.ts` - Added to notification schema
- `src/components/auth/RegisterForm.tsx` - Added checkbox option
- `src/app/api/auth/register/route.ts` - Save preference on registration
- `src/app/(dashboard)/dashboard/settings/page.tsx` - Toggle in settings
- `src/app/api/user/notification-preferences/route.ts` - GET/PATCH handlers

### Admin Alerts Page (`/admin/alerts`)

Full CRUD for general community alerts with email notification capability.

**Features:**
- Create/edit/delete alerts
- Alert types: general, bulletin, announcement, warning
- Urgency levels: normal, high, urgent
- Pin to top option
- Expiration date
- "Save" vs "Save & Notify" buttons
- Sends emails to subscribers with `communityAlerts: true`

**Files Created:**
- `src/app/(admin)/admin/alerts/page.tsx` - Admin UI
- `src/app/api/admin/alerts/route.ts` - GET (list) + POST (create)
- `src/app/api/admin/alerts/[id]/route.ts` - GET/PATCH/DELETE

### Admin Kosher Alerts Page (`/admin/kosher-alerts`)

Full CRUD with approval queue for user-submitted kosher alerts.

**Features:**
- Create/edit/delete kosher alerts
- Alert types: recall, status_change, warning, update
- Certifying agencies dropdown: COR, OU, OK, Star-K, Kof-K, cRc, MK, other (custom)
- Approval workflow: pending → approved/rejected
- Quick approve/reject buttons for pending items
- Sends emails when approving user submissions
- "Save & Notify" button sends to subscribers with `kosherAlerts: true`

**Files Created:**
- `src/app/(admin)/admin/kosher-alerts/page.tsx` - Admin UI
- `src/app/api/admin/kosher-alerts/route.ts` - GET (list) + POST (create)
- `src/app/api/admin/kosher-alerts/[id]/route.ts` - GET/PATCH/DELETE

### Public Kosher Alerts User Submission

Users can submit kosher alerts from the public `/kosher-alerts` page.

**Features:**
- "Report Kosher Alert" button opens modal
- Requires login (shows sign in prompt if not authenticated)
- Form fields: product name, brand, alert type, agency, description, effective date
- Submissions go to pending queue for admin review
- Auto-approves if user has `canAutoApproveKosherAlerts` permission

**Files Created:**
- `src/components/kosher-alerts/KosherAlertSubmitModal.tsx` - Client component modal
- `src/app/api/community/kosher-alerts/route.ts` - GET (public list) + POST (submit)
- Updated `src/app/(public)/kosher-alerts/page.tsx` - Added submit button, improved styling

### Database Schema Updates

**Migration:** `migrations/2026-02-24-alerts-schema-update.sql`

```sql
-- Add columns to kosher_alerts table
ALTER TABLE kosher_alerts
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS issue_date DATE;

-- Add community_alerts notification preference
ALTER TABLE email_subscribers
ADD COLUMN IF NOT EXISTS community_alerts BOOLEAN DEFAULT false;
```

### Key Files Summary

| File | Purpose |
|------|---------|
| `src/app/(admin)/admin/alerts/page.tsx` | Admin alerts management UI |
| `src/app/(admin)/admin/kosher-alerts/page.tsx` | Admin kosher alerts with approval queue |
| `src/app/api/admin/alerts/route.ts` | Admin alerts API |
| `src/app/api/admin/kosher-alerts/route.ts` | Admin kosher alerts API |
| `src/app/api/community/kosher-alerts/route.ts` | Public submission API |
| `src/components/kosher-alerts/KosherAlertSubmitModal.tsx` | User submission modal |
| `src/components/admin/NewsletterForm.tsx` | Fixed Select component |

---

### 2026-03-11 - Homepage Business Advertising System

**Summary:** Implemented tiered homepage advertising for businesses with banner and sidebar ad placements.

#### Subscription Tier Updates

Added 4th tier (Elite) and updated features:

| Tier | Price | Sidebar | Banner | Photos | Categories |
|------|-------|---------|--------|--------|------------|
| Free | $0 | No | No | 0 | 1 |
| Standard | $27/mo | Yes | No | 5 | 3 |
| Premium | $65/mo | No | Yes | 15 | 5 |
| Elite | $120/mo | Yes | Yes | Unlimited | Unlimited |

#### Database Changes

```sql
-- New columns in subscription_plans
ALTER TABLE subscription_plans ADD COLUMN show_in_homepage_banner BOOLEAN DEFAULT false;
ALTER TABLE subscription_plans ADD COLUMN show_in_homepage_sidebar BOOLEAN DEFAULT false;

-- New columns in businesses
ALTER TABLE businesses ADD COLUMN banner_image_url VARCHAR(500);
ALTER TABLE businesses ADD COLUMN tagline VARCHAR(150);
```

#### Key Components Created

| Component | Purpose |
|-----------|---------|
| `src/components/homepage/HomepageBanner.tsx` | Carousel banner ad after hero (3 random businesses) |
| `src/components/homepage/HomepageSidebarAds.tsx` | Sidebar ads on desktop, horizontal scroll on mobile |
| `src/app/api/featured-businesses/route.ts` | API for fetching random eligible businesses |

#### Homepage Layout Changes

- **Banner**: Full-width carousel after hero section, shows 3 random businesses with banner images
- **Desktop**: 3-column layout with sidebar ads on left/right sides
- **Mobile**: Horizontal scrollable ads below explore section, widgets at bottom

#### Business Selection Logic

Businesses appear in ads only if:
1. `approvalStatus = "approved"`
2. `isActive = true`
3. Subscription plan has appropriate placement enabled
4. `bannerImageUrl` is not null (required for visibility)

#### Files Modified/Created

- `src/lib/db/schema.ts` - Added new columns
- `src/app/(admin)/admin/subscription-plans/page.tsx` - Updated UI for new features
- `src/app/api/admin/subscription-plans/route.ts` - Updated create schema
- `src/app/api/admin/subscription-plans/[id]/route.ts` - Updated update schema
- `src/app/page.tsx` - Updated homepage layout with ad components
- `src/components/admin/BusinessForm.tsx` - Added tagline and banner image fields
- `src/lib/validations/content.ts` - Added tagline and bannerImageUrl to businessSchema
- `src/app/api/businesses/create/route.ts` - Added tagline field
- `src/app/api/admin/businesses/[id]/route.ts` - Added tagline and bannerImageUrl to update

#### Preloader Fix

Fixed issue where page would wait 3.2s even when preloader was already shown in session:
- `src/components/layout/PageWrapper.tsx` - Checks sessionStorage before applying delayed animation
- `src/app/globals.css` - Added `.animate-page-fade-in-immediate` class for quick fade-in

#### Future Tasks

- Analytics for homepage ad impressions/clicks (per plan tier)
- File upload for banner images (currently URL-based)

---

### 2026-03-18 - Universal Fuzzy Search System

**Summary:** Replaced all separate search implementations across the site with a single reusable `<UniversalSearch />` component backed by one unified API endpoint (`/api/search/suggestions`) using PostgreSQL `pg_trgm` fuzzy matching.

#### Architecture

- **One component:** `src/components/search/UniversalSearch.tsx` — accepts `searchType` prop to scope results
- **One API:** `src/app/api/search/suggestions/route.ts` — accepts `type` param (businesses, classifieds, shuls, shiurim, events, ask-the-rabbi, all)
- **One query module:** `src/lib/search/fuzzy-search.ts` — per-type query builders with scoring
- **Shared types:** `src/lib/search/types.ts` — `SearchSuggestion`, `SearchType`, `SuggestionsResponse`

#### Features

- Live dropdown with up to 8 fuzzy-matched suggestions
- Multi-word highlighting in yellow
- Keyboard navigation (Arrow Up/Down, Enter, Escape)
- Click suggestion → navigate to detail page
- Press Enter → parent page filters/searches
- AbortController cancels stale requests
- 300ms debounce, min 2 chars (3 for type=all)
- Type badges in "all" mode (Business, Shul, Shiur, Event, etc.)

#### Search Fields Per Type

| Type | Fields Searched | Visibility Filters |
|------|----------------|-------------------|
| businesses | name, description, category (LEFT JOIN) | approved + active |
| classifieds | title, description, category (LEFT JOIN) | approved + active |
| shuls | name, rabbi, address | active |
| shiurim | title, teacherName, projectOf | active + approved |
| events | title, description (ILIKE only), location | active + approved + future only |
| ask-the-rabbi | title, question (multi-word w/ word_similarity) | published |

#### Pages Modified

| Page | Change |
|------|--------|
| `/shuls` | Added search bar in hero, client-side filtering via useMemo |
| `/shiurim` | Added search bar in hero, client-side filtering via useMemo |
| `/community/calendar` | Added search bar in hero, filters both calendar and list views |
| `/directory/search` | Replaced basic form with `DirectorySearchBar` wrapper using UniversalSearch |
| `/classifieds` | Replaced basic input with UniversalSearch in ClassifiedsBrowser |
| `/ask-the-rabbi` | Replaced AskTheRabbiSearch with `AskTheRabbiSearchBar` wrapper |
| Homepage hero | Replaced ~70 lines of inline search with UniversalSearch |
| `/search` results page | Updated to use suggestions API, supports all 6 content types |

#### Files Created

| File | Purpose |
|------|---------|
| `src/lib/search/types.ts` | Shared search types |
| `src/lib/search/fuzzy-search.ts` | Per-type fuzzy query builders |
| `src/components/search/UniversalSearch.tsx` | Reusable search component |
| `src/app/api/search/suggestions/route.ts` | Unified suggestions API |
| `src/components/directory/DirectorySearchBar.tsx` | Client wrapper for server component page |
| `src/components/ask-the-rabbi/AskTheRabbiSearchBar.tsx` | Client wrapper for server component page |
| `scripts/enable-universal-search-indexes.ts` | Trigram index creation script |

#### Files Deleted

| File | Reason |
|------|--------|
| `src/components/ask-the-rabbi/AskTheRabbiSearch.tsx` | Replaced by UniversalSearch |
| `src/components/directory/DirectorySearch.tsx` | Replaced by UniversalSearch |
| `src/app/api/ask-the-rabbi/search/route.ts` | Consolidated into suggestions API |
| `src/app/api/search/route.ts` | Consolidated into suggestions API |

#### Database Indexes Created

Trigram GIN indexes on: shuls (name, rabbi), shiurim (title, teacher_name), events (title), businesses (name, description), classifieds (title, description). Ask the Rabbi indexes already existed.

#### Design Spec

Full spec at `docs/superpowers/specs/2026-03-18-universal-fuzzy-search-design.md`

---

### 2026-03-18 - Homepage Ads, Header Redesign, Shul Documents System

#### Newsletter Cron Fix
- Removed every-minute cron; newsletters now send immediately on admin trigger (Vercel Pro 60s timeout)
- `vercel.json` no longer has newsletter cron entry

#### Zmanim Page
- Added date picker, month skip buttons (double chevrons), "Today" button
- Prominent Shabbat banner showing candle lighting + havdalah at top of week

#### Header Redesign
- Removed top blue bar (redundant — auth in dropdown/hamburger)
- Logged out: "Log in" + "Sign up" button; Logged in: first name + initials avatar circle
- Removed search icon (hero search handles it)
- Tighter nav padding at `xl`, logo text hidden at `xl` to prevent overflow, restored at `2xl`
- Mobile nav scrollable (`overflow-y-auto`)

#### Ask the Rabbi
- Fixed sort order (`id DESC` instead of broken `ORDER BY 1`)
- Hide "Question #" when questionNumber is null

#### Auth Forms
- Password visibility toggle on Register and Reset Password (Login already had it)

#### Shiur Detail Page
- Complete redesign: overlapping card layout, icon-based sidebar details, Google Maps link
- Schedule/location/contact sections with proper hierarchy

#### Admin Shiurim Form
- Schedule: card-per-day layout with notes as resizable Textarea below times
- Fixed `shulId` string→number conversion, fixed location dropdown (`businessName`→`name`)
- Start/end dates now optional (empty by default)

#### Shul Documents System (Newsletters & Tefillos)
- **Schema**: `shul_documents` table (shulId, title, type, fileUrl, fileSize, description, uploadedBy)
- **Upload API**: Extended `/api/upload` to accept PDFs (10MB limit)
- **Admin**: "Docs" button on shul table → dialog with upload form, preview cards, edit/delete
- **Dashboard**: Shul managers can upload from `/dashboard/shuls/[id]`
- **Public**: Newsletters + Tefillos sections on shul detail page with PDF/image preview cards
- **Cache**: `revalidatePath` on create/delete instead of `force-dynamic`
- Edit supports title/type/description changes + optional file replacement

#### Other Fixes
- Footer: removed placeholder social icons, kept only email (redundant removed too)
- Calendar hero: "Community Events" → "Calendar"
- Event detail: removed icons from type badges
- Davening notes: multiline Textarea + proper display below time/day on public page
- Blog benefit added to register page member benefits
- File inputs: `cursor-pointer` for clickable indication

---

### 2026-03-18 - Admin Sidebar Reorganization

**Summary:** Collapsed 16 flat admin sidebar links into 10 grouped links with tab-based sub-navigation. Built 2 new admin pages (Eruv Status, Important Numbers).

#### New Sidebar Structure

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

#### Key Components

| Component | Purpose |
|-----------|---------|
| `src/components/admin/AdminTabs.tsx` | Reusable tab nav — horizontal on desktop, vertical stack on mobile |
| `src/app/(admin)/admin/shuls/layout.tsx` | Shuls group layout (hides tabs on `[id]` detail pages) |
| `src/app/(admin)/admin/businesses/layout.tsx` | Businesses group layout |
| `src/app/(admin)/admin/programs/layout.tsx` | Programs group layout |
| `src/app/(admin)/admin/community/layout.tsx` | Community group layout (7 tabs) |

#### New Pages Built

| Page | Route |
|------|-------|
| Eruv Status | `/admin/community/eruv` — toggle Up/Down, date, message, history table |
| Important Numbers | `/admin/community/important-numbers` — CRUD table with dialog form |

#### New API Routes

| Route | Methods |
|-------|---------|
| `/api/admin/eruv` | GET, POST (upsert by date) |
| `/api/admin/eruv/[id]` | PATCH |
| `/api/admin/important-numbers` | GET, POST |
| `/api/admin/important-numbers/[id]` | PATCH, DELETE |

#### Route Migration

All old page routes moved to new locations. API routes (`/api/admin/*`) did NOT move — pages call the same endpoints from new locations.

#### Hardcoded Links Updated

- Dashboard links: `/admin/content?status=pending` → `/admin/approvals`
- Shiva email template: `/admin/content/shiva` → `/admin/community/shiva`
- Tehillim email template: `/admin/content` → `/admin/community/tehillim`

#### Design Spec

`docs/superpowers/specs/2026-03-18-admin-sidebar-reorganization-design.md`

---

### 2026-03-18 - Blog System

**Summary:** Built a full blog system where admins post freely, users submit for approval, and readers can comment with flexible moderation.

#### Database Tables

- `blog_categories` — id, name, slug, displayOrder
- `blog_posts` — id, title, slug, content (HTML), contentJson (TipTap JSON), coverImageUrl, excerpt, authorId, categoryId, customCategory, approvalStatus, commentModeration, viewCount, publishedAt, isActive
- `blog_comments` — id, postId, authorId, content, parentId (1-level threading), approvalStatus, isActive
- Added `canAutoApproveBlog` to users table

#### Comment Moderation

Three-tier cascade: post-level override → global site setting (`blog_comment_moderation` in site_settings) → default open. Admin comments always auto-approve.

#### Routes

**Public:** `/blog` (listing), `/blog/[slug]` (detail with comments)
**Admin:** `/admin/programs/blog` (management + categories dialog), `/admin/programs/blog/new`, `/admin/programs/blog/[id]/edit`, `/admin/programs/blog/comments`
**Dashboard:** `/dashboard/blog` (user's posts), `/dashboard/blog/new`, `/dashboard/blog/[id]/edit`

#### API Routes

| Namespace | Routes |
|-----------|--------|
| `/api/admin/blog` | Posts CRUD, categories CRUD, comments moderation |
| `/api/blog` | Public listing, detail, comments (GET + POST), categories |
| `/api/user/blog` | User's own posts CRUD with approval flow |

#### Key Components

| Component | Purpose |
|-----------|---------|
| `src/components/blog/BlogPostEditor.tsx` | Shared TipTap editor form (admin + dashboard) |
| `src/components/blog/BlogComments.tsx` | Threaded comments with moderation notice |
| `src/components/blog/BlogListing.tsx` | Public blog grid with category filter |

#### Navigation

- Blog added as first item in Community dropdown
- Blog tab added to admin Programs group
- Blog added to universal fuzzy search system

#### Design Spec

`docs/superpowers/specs/2026-03-18-blog-system-design.md`

---

### 2026-06-07 - Admin Notification Coverage & Approval Gating

**Spec:** `docs/superpowers/specs/2026-06-07-admin-notification-coverage-design.md` (4 phases, committed separately)

**Phase 0 — Approval gating:** pending/unpublished content now 404s publicly. ATR detail + business detail use post-query owner/admin preview bypasses (with "Pending approval — only visible to you" banner); classifieds/directory-category-API/shiurim got blanket filters. F1: `formType` is now `z.enum(FORM_TYPES)`. F2: event broadcast batches are individually try/caught.

**Phase 1 — `notifyAdminOfSubmission()`** in `src/lib/notifications.ts`: single entry point wired into all ~24 submission points (28 calls). Always inserts in-app notifications for all admins; Tier A pending (+ tehillim) also emails `formEmailRecipients`; fully try/caught (`[NOTIFY]` prefix) — never breaks a submission. Non-profit/shoutout migrated off `ADMIN_NOTIFICATION_EMAIL` env var. New FORM_TYPES: shiva, tehillim, kosher_alert, non_profit, shoutout, daily_digest. Migration script (NOT yet run): `scripts/migrate-digest-recipients.ts`.

**Phase 2 — Pusher:** channel `private-admin-notifications`, auth at `POST /api/pusher/auth` (explicit auth() + admin + channel check). `src/lib/pusher.ts` no-ops without env vars (PUSHER_APP_ID/KEY/SECRET/CLUSTER + NEXT_PUBLIC_PUSHER_KEY/CLUSTER — **not yet set in .env or Vercel**). Both notification `setInterval`s deleted; `AdminNotificationsProvider` context = single count source (one fetch on mount + one subscription) shared by sidebar badge + header bell.

**Phase 3 — Daily digest:** cron `0 13 * * *` → `/api/cron/notification-digest` (CRON_SECRET bearer). count(*) per Tier B type; zero pending → no email; otherwise one email to `formEmailRecipients(form_type='daily_digest')`. Business videos counted as `videoStatus='ready' AND videoApprovalStatus='pending'` (matches admin video-review queue; bare pending would count video-less businesses).

**TODO:**
- Create Pusher Channels app and set the 6 env vars (Vercel + .env) — until then bell works minus live updates
- Run `npx tsx scripts/migrate-digest-recipients.ts` once in prod
- Configure recipients in Admin → Settings for new form types (kosher_alert, non_profit, shoutout, daily_digest)
- Business `pending_payment` creations intentionally don't notify (admin can't act until PayPal webhook flips to pending) — consider notifying from the webhook later

---

### 2026-06 / 07 — Rochel (client) Feedback: 6 Phases

Client feedback brain-dump → 6 phases, all committed/pushed to `main`, deployed, DB migrations run. Each phase was adversarially reviewed + `eslint`/`tsc` to 0 errors before commit.

**P1 — Uploads + event media.** Root-caused the "Unexpected token 'R'" newsletter upload failure: files were streamed through the serverless `/api/upload` (Vercel ~4.5 MB request-body cap). Switched to **client-side direct-to-Blob**: new `src/lib/upload-client.ts` `uploadFile()` + token route `POST /api/upload/blob` (`handleUpload`, auth-gated). Migrated all PDF/image uploaders to it; old `/api/upload` kept only for blob DELETE. Also: event `imageUrl` (cover) + `flyerUrl` now render on the event detail page and calendar list (they were saved but never displayed).

**P2 — Quick wins.** Homepage node network gained a **Shiva** node (icon `HandHeart`, slate). Simcha type-filter badges wired to `?type=slug`. Calendar events **color-coded by type** (grid + list). Shul **newsletters moved above** the calendar on the shul page.

**P3 — Shiva.** Added columns `davening_times`, `levaya_info`, `zoom_info`, `minyan_info`, `attachment_url` to `shiva_notifications` (threaded through submit modal, admin edit, public page, both APIs). Attach the original Misaskim PDF/JPEG. **As-posted email** via `sendShivaNoticeEmail()` on approval (community POST auto-approve + admin PATCH transition into approved, guarded against re-send). **Shiva block in the newsletter** (renderer `renderShivaBlock` + block-data + preview wiring).

**P4 — Newsletters.** New `community_newsletters` table + admin CRUD at `/admin/community/newsletters` (Community tab) + public **`/newsletters`** page aggregating shul newsletters (`shul_documents` type=newsletter) and community newsletters. Nav links under Shuls ▾ and Community ▾.

**P5 — Admin "+ New".** Added POST handlers to `/api/admin/{simchas,shiva,tehillim}` (auto-approved) + a create mode reusing each page's edit dialog (`isCreating` state, `startCreate()`, Dialog `open={!!editEntry || isCreating}`, Cancel resets both).

**P6 — Shul neighborhoods.** New admin-managed `shul_neighborhoods` table (seeded 8 areas) + `shuls.neighborhood` column. Admin manages the list at `/admin/shuls/neighborhoods`; `ShulForm` has a neighborhood select (preserves current value even if deactivated). Public `/shuls` neighborhood filter; unassigned shuls still show under "All". Review caught + fixed a **critical data-loss bug**: the shul edit path didn't carry `neighborhood`, so editing any shul wiped it.

**Also:** all uploads unified to **30 MB** ("Maximum file size is 30MB"); `revalidatePath("/simchas")` on approve/create/delete so approved simchas appear immediately (blogs already instant via `force-dynamic`).

**Deferred (owner's call):** shiva "once-a-day digest" send cadence (only as-posted + Friday built).

**In-flight (separate session):** convert the 3 remaining admin image-**URL** paste fields to the `<ImageDropzone>` uploader — admin simcha "Photo URL", admin classifieds "Image URL", `BusinessForm` "Banner Image URL". Guardrail: keep `bannerImageUrl: validatedData.bannerImageUrl || null` in `src/app/api/admin/businesses/[id]/route.ts` so "" → null and the homepage-ads `isNotNull(bannerImageUrl)` filter stays clean.

**Owner one-time setup:** tag shuls with neighborhoods (Admin → Shuls → edit); optionally upload one community newsletter.

---

### 2026-07-13 — Zmanim Location Picker (view zmanim for any place)

**Summary:** Added an optional "view zmanim for another location" control to the `/zmanim` page and homepage `ZmanimWidget`. Default stays Toronto; a user can search any place by name or use GPS and see that location's zmanim for the week. Not tied to login, no DB — chosen location persists in `localStorage` (`ft_zmanim_location`). Merged to `main` (13 feature commits + merge; **not yet pushed to origin**).

**Spec/plan:** `docs/superpowers/specs/2026-07-13-zmanim-location-picker-design.md`, `docs/superpowers/plans/2026-07-13-zmanim-location-picker.md`.

**How it works (three off-the-shelf pieces, no hardcoded locations):**
1. **Photon** (`photon.komoot.io`) — place name → coordinates, called **client-side** from the browser (see `src/lib/geocode.ts`). *Chosen over a Nominatim server proxy on purpose:* Nominatim's public instance rate-limits/blocks cloud IPs, so a Vercel server proxy would funnel all users through blockable IPs and fail in prod. Client-side distributes load per-user IP; Photon is CORS-enabled + built for autocomplete. `src/lib/geocode.ts` is the single swap point if Photon is ever unreliable (self-host or a keyed provider).
2. **`@hebcal/core`** — coordinates + date → zmanim (already in project; it was only ever handed Toronto). Now parameterized by `ZmanimLocation`.
3. **`tz-lookup`** (new dep, offline) — coordinates → IANA tzid so times display in the location's own clock.

**Key files:**
- `src/lib/zmanim-location.ts` — `ZmanimLocation` type, `TORONTO_LOCATION`, `isTorontoLocation`, `isIsraelCountry`, serialize/parse, `buildZmanimParams`.
- `src/lib/zmanim.ts` — now takes `location: ZmanimLocation = TORONTO_LOCATION`; **fixed a real bug**: `formatZmanTime` + the English date were hardcoded to `America/Toronto` (would show wrong clock times for other zones). `formatZmanTime(date, tzid)` now takes the timezone.
- `src/app/api/zmanim/route.ts` — accepts + validates `lat`/`lon`/`tzid`/`label`/`il` (Toronto default = backward compatible; invalid → 400). `mode=shabbat` intentionally stays Toronto (no caller uses it).
- `src/lib/geocode.ts` — Photon `searchPlaces`/`reverseGeocode`.
- `src/components/zmanim/LocationPicker.tsx` — shared component (debounced search, GPS, "Back to Toronto"), `compact` flag for the widget.
- `src/hooks/useStoredZmanimLocation.ts` — shared localStorage hydrate/persist hook used by both consumers (DRY).
- Consumers: `src/app/(public)/zmanim/ZmanimPageContent.tsx` (full picker) + `src/components/widgets/ZmanimWidget.tsx` (compact).

**Halacha decision (confirmed with owner):** Israeli locations get **1-day Yom Tov** via hebcal's `il` flag. The reasoning about candle lighting was that a blanket 40 min is *Jerusalem-specific* and wrong for most Israeli cities — correct reasoning, but see the correction below.

> **CORRECTION (2026-07-27):** the claim that "candle-lighting stays the 18-min default everywhere" is **wrong**. hebcal applies **per-city customs by coordinate**, with no configuration from us: Jerusalem **40 min**, Haifa **30 min**, Tel Aviv and Bnei Brak **18 min**, Toronto **18 min**. Measured across seven coordinate variants around Jerusalem (city centre, Old City, Har Nof, 20 km north) — all resolved to 40 min, so whatever the geocoder returns, the local custom is applied. Verified against Chabad: Jerusalem candles Fri 2026-07-31 = ours 6:56 PM vs Chabad 6:57 PM (we floor, which is the stringent direction for a "not later than" time).

**Notable bug caught only by live verification:** the GPS "Use my location" path silently did nothing under React **Strict Mode** — a `mountedRef` cleanup set it `false` on unmount but setup never reset it `true`, so Strict Mode's setup→cleanup→setup left it stuck `false` and the GPS guard always bailed. Passed unit tests + tsc + code review; only surfaced clicking it in a real browser. Fixed by setting `mountedRef.current = true` in the effect body.

**Tests:** `tests/unit/{zmanim-location,zmanim-calc,zmanim-api-route,geocode}.test.ts` (59 unit tests total, all green; tsc 0 errors). React components verified live (no component test harness in repo).

**Deferred (known, non-blocking):** "today" highlight across far timezones uses the viewer's local day (documented limitation); `revalidate=3600` on the zmanim route is inert now that it reads query params (comment says so).

**Post-launch verification vs MyZmanim (Toronto/NY/Jerusalem, same-day):** all astronomical + GRA times matched MyZmanim to the second (sunrise/sunset/chatzos/plag/alos-16.1°/tzeis-8.5°/sof-zman-shma-GRA). Two **pre-existing** labeling bugs found + fixed (commit `1490c35`):
- Sof Zman Shma/Tefila were labeled "Magen Avraham" but hebcal's `sofZmanShma()` is **GRA** — relabeled the "About" text to GRA (values were already correct GRA; MGA shema would be ~1 hr earlier, not currently shown).
- `tzait72` was `tzeit(16.1°)` (≈114 min in Toronto summer, mislabeled "72") → now **`sunset + 72 fixed clock minutes`** (10:10 PM Toronto, matches MyZmanim's "72 Minutes" row).
- Still known/unchanged: Misheyakir uses hebcal's default degree (~4:32 Toronto) vs MyZmanim's 10.2° (4:42) — a minor opinion difference, left as-is. If MGA sof-zman-shma is ever wanted, add `sofZmanShmaMGA()` as a separate row.
- Also fixed a duplicate-results bug in `src/lib/geocode.ts`: Photon returns multiple OSM entries with identical labels (e.g. two "Jerusalem, Jerusalem District, Israel"); `searchPlaces` now dedupes by label (over-fetch 10 → dedupe → cap 6).

---

### 2026-07-26 — Production domain cutover (emails pointed at vercel.app)

**Symptom:** a new signup received a verification email whose approve link pointed at `https://frum-toronto.vercel.app` instead of the real domain.

**Root cause:** no code bug. Production env vars had been set at project creation (207d prior) and never updated after the domain was acquired:

```
NEXTAUTH_URL        = "https://frum-toronto.vercel.app\n"
NEXT_PUBLIC_APP_URL = "https://frum-toronto.vercel.app\n"
```

Note the **literal trailing newline** baked into both values — that injected a newline into the middle of every generated `href`.

`NEXT_PUBLIC_APP_URL` is the single source for every absolute URL in server-rendered email (~40 usages), so ALL of these were affected: signup verification (`src/lib/email/send.ts:15`), password reset, newsletter unsubscribe/preferences + open/click tracking, shiva notices, event notifications, business video approve/reject, Ask the Rabbi answers, and **PayPal subscription return URLs** (`src/app/api/paypal/create-subscription/route.ts:109`) — the last meaning a paying customer got dropped on vercel.app where their session cookie didn't exist.

**Fix (env only — no code changed):** both prod vars set to `https://www.frumtoronto.com`, newline stripped.

- `www` is canonical: apex `frumtoronto.com` 308-redirects to `www`, which serves 200.
- `NEXTAUTH_URL` is *contractual* — Google exact-string-matches it. Added to OAuth client `275980391799-…`: redirect URI `https://www.frumtoronto.com/api/auth/callback/google` + JS origin `https://www.frumtoronto.com`. Existing localhost/apex/vercel.app entries kept so there was no gap. Changing `NEXTAUTH_URL` without this = `redirect_uri_mismatch` and dead Google login.
- Apex alone wouldn't have sufficed: a 308 mid-OAuth changes host, and NextAuth's `state`/PKCE cookie is host-scoped.

**Deploy:** `vercel redeploy https://frum-toronto-e1enyte6p-…` (needs `--scope daniels-projects-6286b7f6`) — rebuilds the identical source with fresh env vars, shipping zero new code. Env var changes are inert until a redeploy.

**Verified in prod after deploy:**
- `GET /api/newsletter/track/click` (no params → redirects to `APP_URL`, returns before any DB write) → `location: https://www.frumtoronto.com/`
- `/api/auth/providers` → `callbackUrl: https://www.frumtoronto.com/api/auth/callback/google`
- POST to `/api/auth/signin/google` → Google URL carries `redirect_uri=https%3A%2F%2Fwww.frumtoronto.com%2Fapi%2Fauth%2Fcallback%2Fgoogle`

**Open item:** prod `PAYPAL_WEBHOOK_ID` not audited — two IDs exist (`PAYPAL_WEBHOOK_ID_VERCEL` / `PAYPAL_WEBHOOK_ID_PRODUCTION`) and which is active vs. which domain PayPal actually posts to was not verified.

---

### 2026-07-26/27 — Homepage hero redesign ("the dial"), typography, and two zmanim bugs

**Spec:** `docs/superpowers/specs/2026-07-26-hero-dial-redesign-design.md` (494 lines; 4 rounds of adversarial review, 19 findings, all verified against the repo before acting).

#### Two production bugs found while building — both shipped fixes

**1. Candle lighting and havdalah were ALWAYS null, everywhere.** hebcal's `getDesc()` returns `"Candle lighting"` / `"Havdalah"`; the colon and the `(50 min)` suffix appear only in `render()`. `zmanim.ts` matched `startsWith("Candle lighting:")` — with a colon — so neither branch ever fired. `/api/zmanim` returned `"--:--"` for both on every date, the widget's Shabbos section never rendered, and `isShabbat` was never true on a Friday. Fixed by matching without the colon.

**2. Every calendar-day decision was made from the SERVER's clock.** `new HDate(date)`, `new Zmanim(...)`, `HebrewCalendar.calendar({start,end})` and two `date.getDay()` calls all read server-local components, so from ~8 PM Toronto time a UTC server reported **tomorrow's** Hebrew date, parsha and zmanim. `getUpcomingShabbat` had it too and skipped a whole week on Friday night. Line 144 (`toLocaleDateString` with `timeZone`) was already correct — that inconsistency is what proved it was a defect.

New `src/lib/zmanim-day.ts` separates two meanings that were tangled together:
- `todayInLocation()` — "today, where the viewer is": an instant → that location's civil day.
- `anchorCalendarDate()` — "the date the caller picked": must NOT shift. Collapsing these breaks the `/zmanim` date picker by a day.

Both anchor at **12:00 UTC**, because hebcal reads a Date's *local* components to pick the day; noon ± any offset in `[-12, +12)` never crosses midnight. **Limitation:** fails on a server at exactly UTC+12 or beyond (constrains the *server*, not the viewer's location). `addAnchoredDays()` replaces `setDate()` so anchors stay pinned at exactly 12:00Z across DST.

**Neither bug reproduces on an America/Toronto dev machine** — that is why they survived. `vitest.config.mts` now pins the unit project to `TZ=UTC`, and `tests/unit/zmanim-calc.test.ts` relocates the "server" across UTC/Tokyo/Kolkata/Toronto/LA via `process.env.TZ` and asserts all five agree.

#### Havdalah: fixed 50 min → 8.5 degrees

MyZmanim publishes two nightfall rows: "3 stars emerge" (labelled *"36 minutes as degrees"* = 8.5°) and "72 minutes". A fixed 50 min matched neither and contradicted our own tzeis row (site showed tzeis 9:37 and havdalah 9:30 for the same moment). Now `havdalahDeg: 8.5`, matching the tzeis row. Measured against 8.5°, the old fixed offset was ~2 min late in January and **~8 min late in March** — one day's agreement proved nothing, which is why `tests/unit/zmanim-havdalah.test.ts` pins the *definition* across 52 Saturdays plus a NOAA cross-check, not a value.

**Verified (2026-07-27):** Toronto candles 8:23 PM = MyZmanim exactly. Jerusalem candles 6:56 vs Chabad 6:57; Jerusalem Shabbat ends 8:15 vs Chabad 8:16 — 8.5° matches Israeli practice within a minute.

**Open, deliberately not changed:**
- Our minute for havdalah falls on the **lenient** side (we are ~1 min earlier than Chabad). For a time that *ends* Shabbos you would rather round later. Part of a broader rounding-policy question: MyZmanim **rounds** to the nearest minute, `formatZmanTime` **truncates**, so our 6:05:42 sunrise displays as 6:05 and theirs as 6:06. Halachically you want *earliest* times rounded up and *latest* times rounded down; we do neither deliberately.
- Some Israeli communities use 42 min or Rabbeinu Tam 72 min for motzei Shabbos. 72 min is already displayed separately as `tzait72`.
- Misheyakir still uses hebcal's default degrees, not MyZmanim's 10.2 (pre-existing).

`npm run zmanim:verify -- [YYYY-MM-DD] [toronto|jerusalem]` prints our values in MyZmanim's row order for a human diff. Re-run after any `@hebcal/core` upgrade.

#### Typography

Urbanist → **Frank Ruhl Libre** (display, `--font-display`) + **Assistant** (UI/body, `--font-sans`), both with `subsets: ["latin", "hebrew"]`. Urbanist shipped no Hebrew glyphs *and* `layout.tsx` requested `subsets: ["latin"]`, so every Hebrew string — calendar dates, tehillim `hebrewName`, shiva `niftarNameHebrew` — fell back to an arbitrary OS font.

**Gotcha:** the `next/font` variable names must differ from the Tailwind theme tokens they feed. `--font-display: var(--font-display)` is self-referential and silently resolves to nothing. Hence `--font-frank` / `--font-assistant`.

`src/lib/email/templates.ts` still lists `'Urbanist'` in an inline stack — inert (email clients cannot load `next/font`), left alone.

#### The hero

`src/components/home/HeroSection.tsx` (527 lines, six jobs in one client component) → seven focused files under `src/components/home/hero/` behind a **server** component, plus pure `src/lib/hero/{dial,primaryZman,heroData}.ts`.

- **The dial**: tick ring, 72 ticks (one per 20 min, every sixth longer, elapsed ones dimmed), 8 destinations orbiting at **0.5°/sec** (was 3°/sec), hub showing the primary zman.
- **`resolvePrimaryZman()`**: candle lighting → havdalah → upcoming Shabbos → `null`. Needed because candle lighting is null 5 days a week; `null` drives a wordmark fallback so no path can render `"--:--"`. It also rejects `Invalid Date`, which is an *object*, not null, and would render as "Invalid Date".
- **Motion**: pauses on pointer-enter and focus-within (chasing a moving link is a WCAG 2.2.2 failure — Playwright literally refuses to hover one, reporting "element is not stable"). `prefers-reduced-motion` paints one static frame; **verified** by temporarily forcing the flag.
- **Mobile**: no dial, no WebGL. `hidden md:block` keeps a component *mounted*, so the RAF loop is gated on real visibility via ResizeObserver — **measured 0 animation frames in 600 ms at 375px**.
- `page.tsx` is now `async` + `export const dynamic = "force-dynamic"`. Without it Next would statically prerender and freeze candle lighting, eruv and counts at build time.

**Three bugs worth remembering:**
1. Dropping `el.style.left/top = "50%"` from the RAF paint made the JSX percentage and the pixel transform stack, flinging every node out of the ring. The old code carried a comment warning about exactly this.
2. `Math.cos/sin` are not bit-identical across V8 builds, so unrounded SVG coordinates caused a hydration mismatch on all 72 ticks (`78.96497798720155` vs `...152`). `dial.ts` rounds to 4 decimals.
3. `useStoredZmanimLocation` kept per-instance state and read localStorage only on mount, so changing the location in `ZmanimWidget` left the hero stale until a reload. The native `storage` event does **not** fix this — it never fires in the document that performed the write. `setLocation` now dispatches `ft:zmanim-location-changed`; instances listen to that (same tab) and `storage` (other tabs).

**Additive API/hook changes** (existing consumers unaffected): `/api/zmanim` `mode=today` gained `candleLightingISO`, `havdalahISO`, `upcomingCandleLightingISO`, `upcomingParsha` — the formatted fields cannot express absence, since `formatZmanTime(null)` returns the **truthy** string `"--:--"`. `useStoredZmanimLocation` gained a third return value, `isHydrated`.

**Deleted:** 105 lines of dead CSS (`star-twinkle`, `shimmer`, `pulse-ring`, `gradient-shift`, `bounce-slow` + two already-unreferenced blocks), each re-grepped after the old hero was removed. `/api/stats` is now unreferenced but deliberately kept.

**Tests: 61 → 135.** `tsc` 0 errors; `eslint` 0 errors in touched files (43 pre-existing errors elsewhere in the repo, untouched).

**Not done:** `QuickLinks` still duplicates the dial's destinations, and `ZmanimWidget`/`EruvWidget` remain at the bottom of the homepage though the strip now covers them — both left as the owner's call.

---

### 2026-07-29/30 — Legacy MSSQL import, and the search/pagination/verification work it forced

Consolidated from ~16 append-only notes written during the session. **States what is true at the end**; superseded claims were removed rather than left as a trail. A short list of wrong turns worth remembering is at the bottom.

#### Where the legacy data actually lives

Old server `216.105.90.65` (creds `MSSQL_*` in `.env`, **read-only**) hosts 6 databases. Two matter.

**The structural discovery:** the old site had **no** simcha, shiva or kosher-alert tables. All three were *blog categories* inside one shared `FrumShared.dbo.BlogEntries` table (35,007 rows), flagged `MailerSimchas` / `MailerShiva` / `MailerAlerts`. Anyone hunting for "the simchas table" will not find one. Members are separate, in `FrumToronto.dbo.MemberList`.

| Imported into | Rows | Source |
|---|---|---|
`users` / `email_subscribers` | 3,052 / 2,957 | `MemberList` |
`simchas` | 16,542 | cats 114/115/116/117/29 |
`blog_posts` | 3,052 | cats 44/96/45 |
`kosher_alerts` | 1,587 | cat 43 |
`shiva_notifications` | 3,553 — **then deleted**, see below | cat 85 |

`FrumToronto.dbo.Members` (12 rows with Admin/SuperAdmin bits) was deliberately **not** imported: creating admin accounts is a security decision, not a migration one.

#### Scripts (`scripts/legacy-import/`)

All **dry-run by default**; `--commit` writes, `--repair --commit` recomputes text in place, `--limit=N` for a slice.

| File | Purpose |
|---|---|
`lib.ts` | MSSQL connect, OLE-date conversion, HTML→text, target connect, CLI opts |
`parse.ts` | **Pure** functions only — classifiers, shiva name extractor, HTML sanitizer, slugify |
`members/simchas/shiva/kosher-alerts/blog.ts` | the importers |
`verify-all.ts` | source-vs-target counts + 22 invariants. **Run after any re-import.** |
`verify-members.ts` / `verify-users-paging.ts` / `verify-user-search.ts` / `verify-blocked-users.ts` | targeted checks |
`set-imported-optins.ts` | switch broadcast opt-ins off / `--restore` from legacy |
`verify-imported-members.ts` | mark the cohort email-verified |
`export-imported-members.ts` | roster `.txt`, `--with-passwords` for a second file |
`fix-blog-authorship.ts` / `publish-archive-posts.ts` | blog author repair |
`delete-imported-shiva.ts` | remove the imported shiva notices |
`show-test-login.js` | prints one **verified** working credential (run manually) |

`parse.ts` exists because the runners call `main()` at module scope — importing a runner from a test connected to both live databases as a side effect.

#### Data decisions

- **Legacy passwords were plaintext.** Bcrypt-hashed at cost 12 on import (matching `/api/auth/register`), so members keep the password they know. Verified by `bcrypt.compare` against source.
- **156 `RemoveMe` members** asked the old site to stop emailing them: they get a user account but **no `email_subscribers` row at all**, which is what actually guarantees silence.
- **`newsletter` set explicitly** from the legacy `Subscribe` flag, never left to its `true` column default, which would have opted in ~1,500 people who never subscribed.
- **All broadcast opt-ins were then switched OFF** for the whole cohort (2,220 rows). Reverse with `set-imported-optins.ts --restore --commit`. Members re-enable themselves at `/dashboard/settings` or `/newsletter/preferences?token=…`. The three *reactive* prefs (ATR answered, ATR comment replies, blog comment replies) were left on — they only fire from the person's own activity.
- **The cohort was marked email-verified** using their **legacy signup date**, not `now()`, so the record says "this address was on file since then". Two passes were needed: those with a subscriber row (via `old_member_id`), plus the 148 email opt-outs who have no subscriber row and are matched by email. Now ~3,132 of 3,158 verified; the rest are genuine new signups.
- **`event_date` on simchas stays NULL.** The legacy row records when an announcement was *posted*, not when the simcha happened; the post date goes to `created_at`, which is what the page sorts by.
- **`photo_url` stays NULL.** `BlogPicture`/`BlogPictureURL` are empty on all 16,542 rows; `BlogImage` holds a generic badge filename (`MazelTov.JPG`, `ring.jpg`), not a family photo.
- **Blog keeps its HTML** (that page uses `dangerouslySetInnerHTML`) so it is **sanitized** by `sanitizeLegacyHtml` — the repo has no sanitizer dependency. 28 tests cover script/iframe/`on*`/`javascript:`/`expression()`.
- **12 numbered Q&A rows in Message Board were skipped** — Ask-the-Rabbi content that already exists from cat 98.

#### Shiva notices: imported, then deleted

All 3,553 were deleted (`delete-imported-shiva.ts`). They had no value and were doing harm: every one was long expired so the public page (`shiva_end >= today`) showed **0**; their prose sat in `notice_text`, which **nothing renders**; and because the shiva import did not carry the post date into `created_at`, all 3,553 took the import timestamp and sorted **above the one real notice** in the admin queue. They are also the most sensitive data in the import — bereavement details, mourner names, addresses in prose.

Result 3,554 → 1. **Fully reversible:** `shiva.ts --commit` restores them; the `notice_text` column was kept so no migration is needed.

#### Blog authorship

Of the 416 posts that landed on the admin placeholder: **133** had a real author address (123 from `benolamhaba@koshernet.com` plus 10 one-offs) and were credited to 11 newly created accounts; the remaining **283** had no author at all and are now owned by a **FrumToronto Archive** account (`archive@frumtoronto.com`, user 3159) and published — crediting 283 Torah posts to "admin" reads as an oversight.

Those 11 + archive accounts have **no password** (cannot be logged into) and **no subscriber row** (nothing is emailed). They exist only to own content.

Re-hide if the client objects: `UPDATE blog_posts SET is_active = false WHERE author_id = 3159;`

Final imported-post authorship: 1,395 Rochel · 1,011 Halacha For Today · 283 Archive · 133 Aaron · 123 benolamhaba · ~37 Alan · plus individual contributors.

#### Bugs found and fixed

1. **Windows-1252 numeric entities corrupted 1,168 simcha rows.** The legacy editor stored `’` as `&#146;` — a cp1252 *byte* value, which is an invisible C1 control character in Unicode, so `String.fromCodePoint` produced garbage ("Canadas" for "Canada’s"). Fixed with a cp1252 table plus support for **unterminated** entities (`&#146Mitzvos`) and **double-encoded** rows (`&amp;amp;`, `&lt;br&gt;`) via strip-then-decode to a fixed point. Repaired in place.
2. **`/kosher-alerts` took 46 seconds** after the import — unbounded `select()` under `force-dynamic`. Same latent bug `/simchas` had. Both now paginate.
3. **`/admin/users` was unusable** at 3,146 rows — no search, filter *or* pagination, rendering every row with all 24 permission columns.
4. **The admin user search dropped characters while typing.** `UserFilters` echoed the URL back into a controlled input, so a debounce push of "ab" overwrote a newer "abc". Fixed with a `lastPushedSearch` ref distinguishing our own navigation from an external one.
5. **Full-name search returned nothing.** The whole query was matched inside each column, and no column holds both a first and last name, so *every* full-name search failed. Now each term must match somewhere: AND across terms, OR across columns — the shape `searchAskTheRabbi` already used.
6. **Two X buttons** in the admin search field: `type="search"` makes Chromium draw its own clear button.
7. **`UniversalSearch` displayed queries that were not applied** — it seeded from `initialQuery` on mount only.
8. **Two silent dead ends in forgot-password.** A disabled account received a reset link, reset successfully and still could not log in (the reset never touches `is_active`); and 16 password-less legacy accounts were told "check your email" while the OAuth-only guard sent nothing.
9. **`blog` had no entry in `TYPE_LABELS`** despite already being in `searchAll`, so blog rows in homepage search rendered unlabelled.
10. **`classifieds/[id]/contact` had no authentication at all**, and took `senderEmail` from the request body — so a caller could forge the seller's reply-to.

#### What was built

- **Pagination** via new `src/components/ui/PaginationLinks.tsx` (link-based, for server components) on `/simchas` (24/page), `/kosher-alerts` (25/page) and `/admin/users` (20/page). Item count is **constant at 7 slots** (`src/lib/pagination-items.ts`) so the control never changes width and Next stops moving under the cursor.
- **All list orderings carry an `id` tiebreaker.** 17 `created_at` values in `users` are shared by more than one row, and imported content shares timestamps in bulk — without it `OFFSET` paging repeats or skips rows.
- **Search** on `/simchas`, `/kosher-alerts` and `/blog`, all server-side, all with trigram indexes. `simchas` and `kosher-alerts` are new `SearchType`s; simchas and kosher alerts also feed `searchAll`. The multi-word matcher is shared: **`buildSubstringCondition(columns, search)`** in `src/lib/search/substring-search.ts` (with `parseSearchTerms`), used by the simchas/kosher/blog list queries and by `src/lib/admin/user-search.ts`, so the call sites cannot drift. Unlike `parseWords` in `fuzzy-search.ts` it **keeps single characters** — this is substring matching, not trigram similarity, so dropping a 1-char term would silently apply no filter at all.
- **`/simchas/[id]` detail pages** so each of 16,542 announcements is shareable, with related items and OpenGraph metadata.
- **Simcha type filter pills** with live result counts that honour the active search.
- **`/admin/users`** with debounced search, role filter and an **All / Active / Blocked** status filter (blocking already worked; finding blocked accounts did not).
- **`UserPicker`** replacing a 3,146-entry `<Select>` in the shul-manager dialog, with AbortController so a slow earlier response cannot overwrite a newer one.
- **Verification gate** on all 23 submission endpoints via `assertCanPost()`, plus `POST /api/auth/resend-verification`, which **did not exist** — the verification email had only ever been sent once, at registration.
- **Component testing now works**: `@testing-library/react` was installed but `jsdom` was not. Added `jsdom`, `user-event`, `@testing-library/dom`, `tests/unit-setup.ts`, and `.tsx` in the unit glob (per-file `// @vitest-environment jsdom`).

#### Semantics worth knowing

- **`isActive` is the ban flag** — checked in password login (`auth.ts:127`), the Google `signIn` callback (`auth.ts:37`) and admin notifications. It blocks **both** sign-in paths. The admin "Active" switch is the block control.
- **`emailVerified` gates nothing by itself** — it is written in three places and read only by the new `assertCanPost`. Before this session it controlled nothing at all: an unverified user had identical access.
- **`assertCanPost` reads the database, not the JWT.** `emailVerified` is not in the token, and putting it there would go stale — someone verifying mid-session would keep being refused until their token refreshed. It also re-checks `is_active`, since a session can outlive a block, and deliberately does not import `auth` (callers pass `session.user.id`), which keeps it loadable in tests without dragging next-auth into a node environment.
- **A password reset deliberately does NOT reactivate an account.** Since `isActive` is the ban, that would let anyone banned un-ban themselves from the forgot-password form.
- **98 accounts are blocked: 96 from the import, 2 that predate it** — a blanket "activate all" would un-ban two genuine blocks. Evidence the 96 were not real bans: none flagged, all had working passwords, 83 of 101 created in 2010, and ids 1139–1148 are ten *consecutive* legacy signups deactivated together. Unchanged pending Daniel's call; `verify-blocked-users.ts` lists them.

#### Migrations (all applied to primary)

- `2026-07-29-legacy-import-old-id.sql` — `old_id` on simchas/shiva/kosher_alerts/blog_posts with **partial UNIQUE indexes** (`WHERE old_id IS NOT NULL`) so a duplicate import is impossible at the DB level; unique index on the long-dormant `email_subscribers.old_member_id`; `idx_simchas_listing`.
- `2026-07-29-shiva-notice-text.sql` — `notice_text` + window index.
- `2026-07-30-simchas-search-indexes.sql`, `2026-07-30-kosher-alerts-search-indexes.sql`, `2026-07-30-blog-search-indexes.sql` — trigram GIN indexes.

New runner `scripts/apply-sql-file.ts <file.sql> [--test]`; it **refuses** files containing DROP/TRUNCATE/DELETE.

#### Local artefacts (gitignored, on disk only)

- **`imported-members.txt`** (~327 KB) — every imported member with legacy MemberID, email, active/verified/password status and notification flags, plus the opt-outs listed separately. Snapshot taken **before** the cohort was marked verified, so it is also the undo reference.
- **`imported-members-passwords.txt`** (~196 KB) — original legacy passwords, written only with `--with-passwords`. **Live plaintext credentials**; because the old site stored them unhashed and people reuse passwords, treat it as working credentials for *other* services too. Delete when done.

Both are gitignored deliberately: a private repo still makes committed PII effectively permanent in git history. Regenerate any time:

```
npx tsx scripts/legacy-import/export-imported-members.ts [--with-passwords]
```

The assistant sandbox refuses to generate or read the passwords file, and refuses `show-test-login.js`, so both are run manually.

#### Known content loss (unavoidable)

Legacy images were served from `www.frumtoronto.com/Local/CalendarImages/` and the old server; **both 404 today**. Dropped rather than rendered broken: **360** in blog posts, and **13 kosher alerts whose payload *was* the image** (e.g. a Costco Kosher-for-Passover list) are now title-plus-thin-text.

#### Accepted quirks

~32 of 1,354 Message Board posts are simcha announcements, so the odd simcha appears tagged "Blog" in search. **Not duplicates** — `old_id` overlap between `blog_posts` and `simchas` is **0**; the old site simply filed them there.

`searchAll` scores relevance **per type** (`1000 - index*10`), so the top hit of every type ties at 1000 and types interleave arbitrarily. Pre-existing; more visible now that nine types feed it. Fixing it needs cross-type normalisation.

#### Verification

`verify-all.ts`: all content counts match source exactly, 22/22 invariants at 0. All importers re-run to **0 inserts**. **Tests 61 → 351** (293 unit + 58 integration). `tsc` 0 errors.

Admin pages could not be exercised in a browser (admin auth, no password available) — confirmed to compile and guard correctly (307 redirect, API 401). Public pages checked live including filters, last page, out-of-range and junk `?page=`.

#### Wrong turns worth remembering

- **Two regression tests initially passed against the broken code.** The typing test applied the URL synchronously inside `router.replace`, so the keystroke never raced the commit; the AbortController test used a 500 ms stale response that still resolved *before* the newer one. Both were only trustworthy after being verified to fail with the bug reintroduced. **A regression test that passes on broken code is worse than none.**
- **`/shuls`, `/shiurim` and `/community/calendar` were wrongly recorded as filtering client-side.** They do not — every dropdown filter is already server-side; only the free-text box runs in the browser, over ≤91 rows. Pagination would also **break** the `/shiurim` weekly grid and `/calendar` month grid, which need the whole visible period. The error came from grepping for `useMemo`/`.filter()` without reading what the `useEffect` sent to the API. **Item closed, do not resurrect.**
- **`aaron@`, `sara@` and `halachafortoday@` were wrongly said to have no accounts.** They do; the blog import matched them correctly all along.
- **`createTestUser` silently dropped fields** three times over — it hardcoded `isActive: true`, coerced an explicit `passwordHash: null` to a default via `||`, and ignored `emailVerified` entirely. Each made a new test fail for the wrong reason. All three fixed.
- **An integration test I added was flaky**: `cleanupTestUsers()` deletes **every** `test-%@frumtoronto.test` user, not just the calling file's, and every file calls it — so asserting over that whole set is order-dependent. **Never assert over the whole `@frumtoronto.test` set; assert on ids you created.**

#### Open items

1. **The 96 blocked legacy accounts** — activate, or leave blocked. Nothing changed.
2. **Mux and homepage ads** — see the findings section below; both are discovery, not code.
3. `searchAll` relevance normalisation (optional).
4. The Neon test branch is a short-lived credential — endpoint `ep-curly-union-ah4r8uel` in `.env.test`, and **`TEST_DB_ENDPOINT` in `tests/setup.ts` must be updated to match any new branch** or every integration run aborts.

---

### 2026-07-30 — Findings: Mux video and homepage ads are both built-but-not-usable

Two systems that look finished in the codebase but cannot currently work. Recorded because in both cases someone would otherwise start building on top of a false assumption.

#### Mux: fully coded, zero configuration

14 files: `src/lib/mux/client.ts` (raw REST via `fetch`, **no npm package by design**), `POST /api/mux/create-upload`, `POST /api/webhooks/mux` (with real HMAC signature verification), `businesses/[id]/video` + `.../uploaded`, admin `video-review` page with approve/reject routes, `MuxVideoUploader.tsx` wired into the business dashboard, and schema columns `muxPlaybackId` / `muxAssetId` / `muxUploadId` / `videoStatus` / `videoApprovalStatus` / `videoRejectionReason`.

**None of it can run:**
- `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SIGNING_SECRET` are **missing locally and there are zero Mux variables in Vercel**. Also absent from `.env.example`, so nothing signals they are required.
- `show_video` is **false on all four plans**, so no tier offers video.
- All 1,633 businesses show `video_status = 'none'`, 0 asset ids, 0 playback ids. Never used.

**`show_video` is doing double duty — it also grants shoutouts.** At `src/app/api/businesses/[id]/route.ts:95`:

```ts
const isElite = business.showVideo === true ||
  (business.planName || "").toLowerCase().includes("elite") ||
  (business.planSlug || "").toLowerCase().includes("elite");
```

So enabling `show_video` on, say, Premium silently makes every Premium business "Elite" for **shoutout** purposes as well. Almost certainly unintended coupling, and worth untangling before the flag is flipped — otherwise turning on video quietly grants a second paid feature.

**Nothing user-facing can reach the upload today.** The only entry point is `MuxVideoUploader` in `(dashboard)/dashboard/business/[id]/page.tsx`, rendered behind `{business.showVideo && …}`, and `showVideo` is selected from `subscriptionPlans.showVideo` (`api/businesses/[id]/route.ts:56`) — there is **no per-business override column**, `show_video` exists only on `subscription_plans`. With it false on all four plans the component never mounts, so `/api/mux/create-upload` is never called. The public listing player needs a `muxPlaybackId` and there are none; the admin review queue works but is empty. The API routes are reachable by URL but nothing in the UI calls them.

**Audit tooling added 2026-07-30.** `listAssets()` and `listUploads()` in `src/lib/mux/client.ts` (cursor pagination, bounded by `maxPages` so a pagination bug cannot spin forever against a billed API), plus **`scripts/mux/audit-mux-assets.ts`** — read-only, reconciling Mux against the database in four classes: orphans in Mux (billed storage nothing points at), dead references (business has an `asset_id` Mux does not know, so the public listing shows a broken player), stuck uploads (`mux_upload_id` with no asset, past the 3600s window), and status drift (row disagrees with Mux). It deletes nothing — removing a business's only promo video because a webhook was slow is not recoverable.

**API quirk worth knowing:** the two list endpoints are inconsistent. `/video/v1/assets` returns `data: []` when empty; `/video/v1/uploads` returns `data: {}` — an *object*. Spreading that throws `Spread syntax requires ...iterable[Symbol.iterator] to be a function`, which is exactly how it was found. Both helpers now `Array.isArray`-guard.

**Credentials verified working** 2026-07-30: all three are in local `.env` and the token authenticates (both list endpoints return 200). Account is empty — 0 assets, 0 uploads. **Still zero Mux variables in Vercel**, so production cannot use Mux yet.

**Upload settings to be aware of** (`src/lib/mux/client.ts`): `playback_policy: ["public"]` — anyone with the playback ID can watch, no signed URLs — plus `max_resolution_tier: "1080p"`, `cors_origin: "*"` and a 3600s upload window.

**Setup, from the code rather than Mux's generic docs:** an access token with **Mux Video read+write** (the client does `POST /video/v1/uploads`, `GET /video/v1/assets/{id}` and `DELETE /video/v1/assets/{id}`); a webhook at **`https://www.frumtoronto.com/api/webhooks/mux`** — use `www`, since the apex 308-redirects and a redirect mid-webhook can drop the POST body — for the four events the handler switches on (`video.upload.asset_created`, `video.asset.ready`, `video.asset.errored`, `video.asset.deleted`); then all three env vars in Vercel *and* `.env`, then a redeploy, then the plan flag.

**The trap:** `getMuxAuthHeader()` **throws** when tokens are absent, so `/api/mux/create-upload` returns a 500 rather than a graceful "unavailable". Enabling `show_video` on a tier *before* adding credentials gives paying customers a hard error. **Credentials first, then the plan flag.**

To enable: Mux account → two API tokens → webhook pointed at `https://www.frumtoronto.com/api/webhooks/mux` with its signing secret → all three vars in Vercel *and* `.env` → **redeploy** (env changes are inert until then) → then flip `show_video`.

#### Homepage ads: an ad is a column, not a record

`HomepageBanner` (full-width carousel under the hero, `h-32 → h-48`) and `HomepageSidebarAds` (left/right on desktop, horizontal scroll on mobile, image area `h-40`) are both live in `src/app/page.tsx`. Gated on `subscription_plans.show_in_homepage_banner` / `..._sidebar` — Premium and Elite get banner, Standard and Elite get sidebar.

**Nothing is showing:** 0 of 1,633 businesses have a `banner_image_url`, so `/api/featured-businesses` returns an empty array.

**There is no ads table.** An ad is `businesses.banner_image_url`, which causes every limitation:

| Wanted | Blocked by |
|---|---|
An ad for a non-business (e.g. a semicha programme) | must be a business listing on a paid plan |
Choosing where a flyer links | link is **inferred**: `business.website ? website : /directory/business/{slug}` — nobody picks, and having a website silently overrides linking to the FrumToronto page |
Two ads for one advertiser | one image column per business |
Seeing what is running | nothing to list; it is scattered across 1,633 business rows |
Running an ad for a month | no start/end dates anywhere |
Deliberate ordering | selection is `ORDER BY random()` |
A business submitting artwork | `banner_image_url` appears **only** in admin files; there is no business-facing form, API or dashboard field |

The tell: `ORDER BY random()` gated purely on subscription tier is a **perk** design ("Premium gets homepage exposure"), not an **advertising** design (a specific creative, pointing at a specific place, for a specific period). Bolting a control page onto the perk cannot deliver the latter.

**Also note the shape mismatch:** community flyers are typically full-page portrait, and both slots are short and wide. A portrait flyer is either cropped to an illegible strip or letterboxed.

**Agreed direction (planned, NOT built):** a proper `ads` table — image, placement, link type (business page / external / none), link value, optional business, start/end dates, active flag, sort order, approval status — plus an admin page listing everything running with add/toggle/reorder, **businesses uploading with admin approval** (mirroring the video review queue), and a **thumbnail → full-flyer overlay → button to the destination** display so portrait artwork stays readable.

#### 2026-07-30 — shoutouts decoupled from the video flag

Shoutout eligibility was computed in **two** places (`api/businesses/[id]/route.ts` and `.../shoutouts/route.ts`) as:

```ts
const isElite = business.showVideo === true
  || (business.planName || "").toLowerCase().includes("elite")
  || (business.planSlug || "").toLowerCase().includes("elite");
```

The shoutouts route's own select even labelled it `// proxy for Elite tier`. Two faults: enabling `show_video` on a tier would have silently granted that tier **newsletter shoutouts** as well, and matching on the plan *name* meant renaming a plan silently removed them.

`migrations/2026-07-30-plan-shoutouts-capability.sql` adds a real `show_shoutouts` capability, matching the existing `show_video` / `show_in_homepage_*` pattern. The backfill preserves behaviour exactly — the plans that satisfied the old name test get the flag, so only **Elite** has it. `show_video` is false everywhere, so that arm of the OR granted nothing and was not replicated.

`isElite` in the business route is now `canPostShoutouts`, still returned as `isElite` too so any older client keeps working.

**Both flags are now editable in the admin UI.** Neither `showVideo` nor `showShoutouts` was in the admin plans API schema, so both could previously only be changed by raw SQL — which is why `show_video` sits false on every plan. Added to the POST and PATCH schemas and to `FEATURE_LABELS` on Businesses → Plans, as "Video Upload (Mux)" and "Newsletter Shoutouts". The GET uses `.select()` so it already returned them.

5 integration tests pin the decoupling, including that a plan *named* "elite" without the capability gets nothing — the exact case the old logic would have granted.

**Ops lesson worth remembering:** a migration must be applied to **both** the primary DB and the Neon test branch. This one was applied to primary only and every plan-capability test failed with `column "show_shoutouts" does not exist`. Earlier migrations were unaffected only because the test branch happened to be copied from prod *after* they ran:

```
npx tsx scripts/apply-sql-file.ts migrations/<file>.sql
npx tsx scripts/apply-sql-file.ts migrations/<file>.sql --test
```

**Also:** the Neon test branch is short-lived and can drop connections mid-run. A burst of `NeonDbError: Error connecting to database: TypeError: fetch failed` across *unrelated* test files, with the suite taking ~114s instead of ~19s, is the branch suspending — not a code failure. Re-run before investigating; it passed 63/63 twice immediately afterwards.

#### 2026-07-30 — homepage ads: schema foundation

`migrations/2026-07-30-homepage-ads.sql` (applied to **both** primary and the test branch) creates `homepage_ads`, making an ad a record rather than `businesses.banner_image_url`. The plan-based banners keep working; this runs alongside.

Columns: `title` (admin-facing label — an image alone is unscannable in a list), `image_url`, `placement`, `link_type` + `link_url`, `business_id`, `submitted_by`, `approval_status` + `rejection_reason`, `starts_at` / `ends_at`, `is_active`, `sort_order`, `click_count`.

Deliberate choices:
- **`link_type` is `business` | `external` | `none`, chosen rather than inferred.** The old behaviour derived the target from whether the business had a `website`, so nobody could pick and a website silently overrode linking to the FrumToronto page. `none` is a real case — a flyer carrying a phone number needs no click-through, and `resolveAdHref` returns **null** for it so callers must handle it rather than falling back to `"#"`.
- **`business_id` is `ON DELETE SET NULL`**, so removing a business does not silently delete a paid ad.
- **Clicks are counted, impressions are not** — impressions would mean a write on every homepage render.
- **Five CHECK constraints** enforce the enums and reject combinations that would render a dead click (`external` with no URL, `business` with no business) or silently never show (`ends_at` before `starts_at`). Enforced in the database, not just in a Zod schema, because an ad that cannot render is worse than a rejected write.

`src/lib/ads/live-ads.ts` holds `liveAdCondition(placement, now)` — the single definition of "should be on the page right now" (approved + active + within the date window), shared by the public render, the admin preview and the tests, because four clauses duplicated across call sites is how an expired ad stays visible in one of them. `now` is a parameter so tests can ask what would be live at an arbitrary moment. Ordering is `sort_order` then `created_at` — deliberate, unlike the plan-based banners' `ORDER BY random()`; someone paying for a placement should be able to rely on where it appears, and the tie-break stops equal-priority ads flickering between renders.

18 integration tests cover the constraints and the scheduling window in both directions. **Tests: 293 unit + 81 integration = 374.**

**Still to build:** admin ads page (list/add/toggle/approve/reorder), homepage rendering with the thumbnail → full-flyer overlay → destination button, and business-facing submission with admin approval.

---

### 2026-07-30 — Timezone rendering: the same event showed two different times

Triggered by a support ticket about a Bais Yaakov graduation date. The ticket turned out to be a red herring; the investigation found a real production bug.

**The data was never wrong.** `events.start_time` holds correct UTC instants. The bug was purely in rendering, and it split cleanly along `"use client"`:

| | Event #43, stored `2027-01-27 00:30` |
|---|---|
| Calendar list (**client**, viewer's TZ) | Tue Jan 26, 7:30 PM ✅ |
| Event detail (**server**) | Wed Jan 27, 12:30 AM ❌ |

`toLocaleString()` with no `timeZone` uses the *process* timezone. In a browser that is the viewer's (Toronto, right by luck); on Vercel, Node runs **UTC**. So the day *and* time disagreed between two pages of the same site. 140 call sites had no `timeZone`; only 8 set one.

**`src/lib/datetime.ts`** is now the single place this is decided:

- `formatInstant(value, opts)` — pins `America/Toronto`. For `timestamp` columns holding a real moment.
- `formatDateOnly(value, opts)` — **no conversion at all**. For the 12 `date` columns.
- `toDateInputValue` / `toTimeInputValue` / `fromDateTimeInputs` — form helpers; typed times are always read as Toronto, never the browser's zone.

**Decision (owner):** everyone sees Toronto time regardless of where they view from. A shul event at 7:30 PM reads 7:30 PM in Israel too.

#### Three traps — do not re-introduce

1. **`Number.prototype.toLocaleString` shares its name with the Date method.** A codemod turned 37 number-formatting calls (filter counts, "Showing 1–25") into dates; the simchas page rendered `12/31/1969, 7:00:16 PM` as a filter badge. `formatInstant` therefore **deliberately does not accept `number`** — that signature is what makes `tsc` find these. Do not widen it.
2. **Bare local variables named like DATE columns.** `startDate` / `eventDate` in the event detail, shul calendar and `UpcomingEvents` hold `new Date(event.startTime)` — instants, not dates. Classify by *property access* (`simcha.eventDate`), never by name alone.
3. **`expiresAt` is two types**: `date` on `tehillim_list`, `timestamp` on `alerts` and `classifieds`. Resolved from the DB — `tehillim_list` is the only table with both `reason` and `expires_at`, which identifies the four tehillim call sites.

#### Deliberately untouched

- **ICS / Google Calendar export** (`EventActions.tsx`) uses `toISOString()` → `DTSTART:...Z`. Because the stored value is a true UTC instant this is **already correct**; "fixing" it to local time without a TZID would break it.
- **Zmanim** has its own explicit timezone handling.
- **894 legacy `created_at` rows at exactly midnight UTC** — 420 kosher alerts + 474 simchas, all 2005–2010, all `old_id IS NOT NULL`. The old site stored date-only until **June 2010**. These now render one day earlier. Reviewed and **deliberately left alone** (owner's call): 16–21 year old archive rows, not worth an `UPDATE` over production. If ever wanted: `SET created_at = created_at + interval '12 hours' WHERE created_at::time='00:00:00' AND old_id IS NOT NULL`.
- **No `timestamptz` migration.** All 82 timestamp columns are still `timestamp without time zone`, zero use `withTimezone`. Storing UTC in a naive column is the PostgreSQL wiki's "Don't Do This", and it is the reason this class of bug is easy to write. The display fix does not depend on it; it remains the hygiene step that stops recurrence.

#### Also fixed

`EventForm.tsx` read the two halves of a datetime in **different** timezones — `formatDateForInput` used `toISOString()` (UTC), `formatTimeForInput` used `toTimeString()` (local). For any evening event those disagree and saving wrote the mismatch back, **pushing the event one day later on every save**. Both event write paths (admin + public) now go through `fromDateTimeInputs`.

`UserTable.tsx`: **186 of 3,164 users have no first/last name** (legacy import — old `MemberList` had email but no name). `{firstName} {lastName}` rendered as a bare space, leaving the grey email as the only visible text, so those rows read as disabled. The email is now promoted into the dark slot. Note `{a} {b}` with both null renders `" "`, not `""` — the literal space survives, which is why it looked styled rather than broken.

**Verification:** 309 unit + 81 integration = **390 tests** (was 375). `tsc` 0 errors. eslint unchanged at 8 pre-existing errors. Verified live by running the app with `TZ=UTC` (what Vercel runs) and diffing rendered dates against production — event detail now matches the calendar exactly; `/simchas` byte-identical to prod. Admin pages could not be exercised in a browser (no admin password).

---

### 2026-07-30 — User submissions: spec + plan (POC merged, feature not built)

Started from a support ticket asking to change an event date. The ticket was a red herring — the event was
already on the right date — but it exposed that **users cannot edit anything they submit**. Public
submission APIs are `POST`-only for every type except blog.

**Spec:** `docs/superpowers/specs/2026-07-30-user-submissions-design.md`
**Plan:** `docs/superpowers/plans/2026-07-30-user-submissions.md`

**Merged already** (`36fa788`, `d5778a0`) — an events-only POC: `/dashboard/submissions`,
`GET /api/user/submissions`, `GET`/`PATCH /api/community/events/[id]`, `src/lib/events/edit-submission.ts`,
`PublicEventForm` edit mode, 6 integration tests.

#### The defect that shaped the design — do not undo this

Approving does not just flip a status, it **broadcasts to every subscriber**
(`admin/content/[type]/[id]/approve/route.ts:72`, guard `previousApprovalStatus !== "approved"`; same shape
in `admin/shiva/[id]` and `admin/kosher-alerts/[id]`).

So an edit must NOT set `pending`. If it did: correct a typo → `pending` → admin re-approves → the guard
fires → **the whole community is re-emailed**. For shiva that means re-sending a bereavement notice because
someone fixed a street address. Hence a distinct **`pending_edit`** status; broadcast guards fire only on
`pending → approved`. `approval_status` is `varchar(20)` with no CHECK on any table, so the new value needs
no migration.

#### Two defects live on main right now

1. `applyEventEdit` sets `pending` unconditionally, so **an admin or auto-approver editing their own live
   event self-unpublishes it**. The create path computes this correctly; the edit path doesn't even load the
   user row.
2. `Submission.detail` has no `detailKind`, so the list page calls `formatInstant` on everything. The moment
   simchas or shiva join, every date-only row renders **a day early**.

Neither is user-visible yet (nothing links the page for non-events, no notifications fire).

#### Decisions (owner)

One list at `/dashboard/submissions`, all types · edit unpublishes via `pending_edit` · **blog adopts the
same rule** (its current rule is the opposite — it *forbids* editing an approved post) · auto-approvers'
edits stay live, admin notified in-app · shul-linked content editable by **whoever currently manages the
shul**, not only the poster · email on approve+reject, transactional, no opt-out (CASL: consent not needed,
identification still is) · rejection reason optional with written fallback · past items behind a toggle.

#### Facts worth not rediscovering

- **Ownership is the binding constraint.** Only non-NULL owner rows can ever be editable: blog 3,058;
  classifieds 10; simchas 9; events 6; kosher_alerts 1. Everything else is legacy import with NULL owner and
  is permanently invisible to this feature — correct, not a gap.
- **`shiurim` has no owner column** (needs a migration); **`specials` has no public submission API** at all;
  **`ask_the_rabbi`** published rows aren't owned, but `ask_the_rabbi_submissions` **is** and has a `status`.
- Only `blog_posts` had an `updated_at`, so nothing else can detect a concurrent edit-vs-approve race.
- ~15 call sites flip `approval_status` independently. The plan mandates a single `setApprovalStatus`
  writer; anything left off it silently notifies nobody or silently re-broadcasts.

#### Process note

A spec review caught the broadcast defect and a false claim of mine — I wrote "every submission API is
POST-only" after citing blog's PATCH route as the template earlier in the same session. Blog holds more
owned rows than every other type combined. **Re-verify claims about the codebase before writing them into a
spec, even ones established earlier in the same conversation.**

---

### 2026-07-30 (later) — User submissions: Chunk 0 + partial Chunk 1 built

**Branch:** `feature/submissions-impl` (worktree at `../ft-subs`), 7 commits, NOT merged, NOT pushed.
**Plan:** `docs/superpowers/plans/2026-07-30-user-submissions.md` — revision 3, tracks remaining tasks.
**Spec:** `docs/superpowers/specs/2026-07-30-user-submissions-design.md`

Done: **5 of 22 tasks.** Chunk 0 complete; Chunk 1 tasks 1.1 (migration) and 1.2 (per-type config).
Next: **1.3 `resolveApprovalStatus`**, then 1.4 `canEditRow`, 1.5 `setApprovalStatus`, 1.6 notifications.

#### Migration IS applied to production

`migrations/2026-07-31-submission-edits.sql` ran against **primary and the test branch**. Adds
`broadcast_at`, `rejection_reason`, `updated_at` (+ 8 indexes) to the eight in-scope tables, and backfills
`broadcast_at` on ~22,953 already-approved rows. Verified: 0 approved rows unstamped, 0 unapproved rows
stamped. All additive and idempotent. **The deployed code does not yet know about these columns** — that is
the safe ordering, and production is unaffected until a deploy.

#### Decisions the owner made — do not re-litigate

| Decision | Choice |
|---|---|
| Structure | **One list** at `/dashboard/submissions`, all types (not a page per type) |
| Editing an approved item | **Unpublishes it**, via a distinct `pending_edit` status |
| Blog's conflicting rule | **Blog adopts the unpublish rule** — sequenced last, 3,058 rows depend on it |
| Auto-approvers/admins | Their edits **stay live**; admin gets an in-app (not email) notification |
| Shul-linked content | Editable by **whoever currently manages the shul**, not only the poster |
| Notifications | Email on approve AND reject, plus an in-app record |
| Rejection reason | **Optional**, with written fallback copy |
| Email opt-out | **None — transactional.** CASL: consent not needed, identification still is |
| Old items | Active by default, past behind a toggle |
| Shiva | **In scope**, same rule, plus a stronger warning + a test that re-approval never re-sends |
| Scope | All types EXCEPT specials (no submission API), shiurim (no owner column), published ask_the_rabbi |

#### The thing that shapes the whole design

Approving does not just flip a status — **it broadcasts to every subscriber**. So an edit must never leave a
row looking like a new submission. Two guards now exist:

1. `pending_edit` — a distinct status; the four broadcast guards fire only on `pending → approved`.
2. **`broadcast_at`** — the real fix. A transition rule alone is defeated by
   `approved (broadcast) → edit → pending_edit → reject → edit → pending → approve`, because `rejected`
   erases publication history. A broadcast is a fact about the **row**: gate on `broadcast_at IS NULL`.

#### Bugs fixed along the way (independent of the feature)

- **Public shul pages had no approval filter** — `(public)/shuls/[slug]/page.tsx` and
  `api/shuls/slug/[slug]/route.ts` listed events on `isActive` + future date only. Same for the public
  organisation typeahead.
- **All four broadcast guards were denylists** (`previous !== "approved"`), including
  `admin/events/[id]/route.ts` which no draft of the plan had listed.
- **`alerts` could not be approved at all** — no `approvalStatus` in its admin PATCH schema, and absent from
  the shared approve route's `tableMap` (which still covers only 4 of 8 types).
- **17 `updatedAt` columns had zero `$onUpdate`** — every one frozen at insert since the project began. Now
  fixed, so the eruv widget's "updated" time and the video-review queue's ordering become truthful **after
  the next deploy**.

#### Traps — each cost real time

- **Most `=== "pending"` matches are OTHER state machines.** The grep finds ~53; only **~20** belong to the
  eight in-scope tables. `newsletter_sends.status`, `ask_the_rabbi_submissions.status`
  (pending/reviewed/answered), shul registration requests, business approval, comment approval and homepage
  ads must NOT be widened. **And the broadcast guards must stay literal** — widening them restores the
  mass-email bug with every test green.
- **Drizzle reports a `date()` column as `PgDateString`, not `PgDate`.** Assuming otherwise mislabels
  simchas / kosher alerts / shiva / tehillim and renders them a day early.
- **`vi.mock` inside `it()` is not hoisted**, and admin routes 401 before touching the DB — so a
  broadcast test that does not mock `auth()` **passes against completely broken code**. Every broadcast test
  needs a hoisted mock, an assertion that the approval actually happened, and a **positive control**.
- **`createTestUser` whitelists 7 of 12 `canAutoApprove*` fields.** Missing: `AskTheRabbi`, `Shuls`,
  `Shiurim`, `Alerts`, `Blog`. A test asking for one silently gets a user without it.
- **`SUBMISSION_TYPES.broadcast` must stay a lazy import** — `@/lib/email/send` pulls in `@/lib/db`, which
  throws without `DATABASE_URL` and breaks the DB-free unit project.
- The `ft-subs` worktree shares one `.git` with the main tree; `node_modules` is symlinked (fine for
  tsc/vitest, but **Turbopack rejects a symlinked node_modules** — hard-link it with `cp -al` for a dev server).

#### Process lesson

Five separate times this session I stated a count or a fact without running the check — including once
inside a fix, where following my own written instruction would have reinstated the bug. Two rounds of
review (one reviewer, then four in parallel) caught 9 wrong factual claims out of 47 and ~40 substantive
defects. **Verify claims about this codebase before writing them into a spec, plan or commit message —
including claims established earlier in the same session, and including claims a reviewer hands you.**

#### Unrelated open items

- **29 commits unpushed on `main`** (mine + the concurrent ads session's). **The timezone fix is therefore
  still not live in production.** Pushing deploys the ads work too — confirm it is deploy-ready first.
- **Estee Kin's event #95** is still `pending`. After a deploy it reads correctly as Monday, June 21, 2027
  at 7:30 PM. Needs approving and a reply; draft is in the session transcript.
- `../ft-preview` worktree still exists (dev server on port 3517, 905MB hard-linked `node_modules`) — safe
  to `git worktree remove` when done.
- `.playwright-mcp/` keeps self-deleting; the path is gitignored but 13 files are still tracked. Wants
  `git rm --cached -r .playwright-mcp`.

---

### 2026-07-30 (session 2) — User submissions: Chunks 0–4 complete

Branch `feature/submissions-impl` in the `../ft-subs` worktree. **~36 commits,
not merged, not pushed.** Spec and plan in `docs/superpowers/`; twelve judgment
calls recorded in `docs/superpowers/2026-07-30-submissions-judgment-calls.md`.

**State:** 518 unit + 382 integration tests, `tsc` clean, eslint unchanged at
the 49-error baseline, `next build` compiles. Migration verified applied to
**primary and the test branch**.

Users can now see, edit and hear back about everything they submit, across all
eight types (events, simchas, classifieds, kosher alerts, alerts, tehillim,
shiva, blog).

#### The rules that hold it together

- **`setApprovalStatus` is the only writer** of `approval_status` for the eight
  in-scope tables. It owns the transition, the broadcast decision and the
  submitter notification.
- **Broadcast fires only when all three hold**: `broadcast_at IS NULL`,
  `previous !== "pending_edit"`, `previous !== next`. The stamp is the
  load-bearing one — a transition rule alone is defeated by a trip through
  `rejected`, which erases publication history.
- **An edit lands on `pending_edit`, never `pending`.** `pending` would make the
  admin's re-approval look like a first approval to every guard, so correcting
  a typo would re-email the subscriber list.
- **Create and edit resolve status through one helper.** The events edit path
  had already drifted from it twice.

#### Traps this session paid for

- **Drizzle silently ignores unknown keys in `.values()`.** Twice a test passed
  green while setting a column that does not exist (`simchaType`, `isActive` on
  shiva). Only `tsc` catches it — run it BEFORE committing, not after.
- **A regression test that passes on broken code is worse than none.** Verified
  every meaningful fix by reinstating the bug and watching the test go red. One
  concurrency test passed against the unguarded version (neon-http gives each
  query its own round trip, so `Promise.all` never interleaves) — deleted
  rather than shipped.
- **A template-literal `import()` in a test** cannot be statically analysed;
  one run in four lost all 54 tests in that file. Use a static map.
- **`cleanupTestUsers` is blanket** (`test-%@frumtoronto.test`) and the content
  tables have no `ON DELETE`, so one file's interrupted afterAll made a LATER
  file fail in beforeAll. It now clears child rows first. Safe only because
  `fileParallelism: false`.
- **Turbopack rejects a symlinked `node_modules`**, so `next build` in the
  worktree needs `cp -al` over the real one first.

#### Defects found in existing code and fixed

- The admin **Reject button on a blog post did nothing**: `blogPostSchema` has
  no `approvalStatus`, so `.partial().safeParse()` stripped it while the toast
  said "Post rejected". Re-approving an already-published post was equally
  silent.
- **A member-submitted alert could not be approved by any admin surface** — the
  list API did not even select `approval_status`.
- **`user/blog` PATCH nulled `publishedAt` on an ordinary edit**, and
  `/api/blog` orders by `publishedAt DESC` where Postgres sorts NULLs FIRST, so
  a corrected post jumped to the top of the blog.
- **`community/shiva` and `community/tehillim` did not treat an admin as an
  auto-approver** while the other five create routes did.
- **Shiva's `attachmentUrl` allowlist was create-only**, so an approved notice
  could be repointed at any URL.
- **Blog PATCH had no `assertCanPost`**, so a blocked account could still edit
  its live post.

#### Not done, deliberately

Shul managers can edit a shul's event but it does not appear in *their*
submissions list. The Select-driven admin edit dialogs can set `rejected`
without offering a reason. The 409 guard catches double-writes, not the
form-open race — that needs the client to echo a version. `applyEdit` and
`setApprovalStatus` are two round trips with no transaction, because
`neon-http` has none.

**Before merge:** decide whether to push (the timezone fix and the ads session's
work are still unpushed on `main`), and note that deploying makes the
`$onUpdate` change to 17 `updated_at` columns user-visible.

---

### 2026-08-06 — Printable monthly zmanim sheet at `/zmanim/month`

Branch `feature/zmanim-month-sheet` (worktree `../ft-zmanim`), 21 commits, **not
merged, not pushed**. Reproduces the luach the site's predecessor published: one
row per civil day, seventeen time columns, Hebrew date, day labels, Daf Yomi,
with molad / sof zman kiddush levanah footnotes and fast-day lines interleaved
in date order.

**State:** 663 unit tests (was 661 before the relocation sweep), `tsc` 0 errors,
eslint unchanged at the repo's 49-error baseline (0 in the feature's own files),
`npm run build` green with `/zmanim` still **○ static** and `/zmanim/month`
**ƒ dynamic**.

#### What was added

| File | Purpose |
|---|---|
`src/app/(public)/zmanim/month/page.tsx` | the route — parses params, degrades to the current month in Toronto on any garbage input |
`.../month/ZmanimSheet.tsx` | renders `SheetLine[]`; contains **no** date arithmetic |
`.../month/MonthPicker.tsx` | month navigation + location |
`.../month/print.css` | print rules, **scoped to the month route** so they cannot leak onto the week view |
`src/lib/zmanim-sheet.ts` | pure: date range → the exact ordered list of lines |
`src/lib/kiddush-levana.ts` | molad + sof zman kiddush levanah footnotes |
`src/lib/daf-yomi.ts` | daf lookup (`@hebcal/learning`) |
`src/lib/zmanim-month-param.ts`, `src/lib/zmanim-location-params.ts` | param parsing, the location parser now shared with `/api/zmanim` |
`src/lib/zmanim.ts` | `getZmanimForRange`, `labelsForDate`, plus alos-72 and misheyakir-45 |

The route is a **separate segment on purpose**. `/zmanim/month` needs
`force-dynamic`; `/zmanim` must stay prerendered. If a build ever shows `/zmanim`
as ƒ, the segment config has leaked — that is a regression, not a detail.

#### Two shitos deliberately differ from the old sheet — owner's call, no rav review

Both were decided by the owner on the evidence below. **Neither has had rabbinic
review.** If a rav is ever consulted, these are the two rows to put in front of
him.

- **Misheyakir prints 10.2°**, matching MyZmanim's published rule for that row.
  hebcal's `misheyakir()` default is 11.5°, ~9.5 min earlier. Against the old
  sheet this moves the printed time by **6 minutes**.
- **Sof Zman Shema (MA) prints the 16.1-degree family**
  (`sofZmanShmaMGA16Point1`), MyZmanim's "72 minutes as 16.1 degrees". The old
  sheet used a **fixed** 72 clock minutes. This moves the printed time by
  **15 minutes**.

Because these two cannot be checked against the old sheet, and checking them
against our own code would be circular, `tests/unit/zmanim-old-sheet-parity.test.ts`
pins them to **MyZmanim** values transcribed by hand (do not generate them from
our code), plus a test asserting we still differ from the fixed-72 shita by
≥14 minutes — so a silent switch back goes red. Every other column is parity-
checked against the old sheet's published August 2026 values at ±1 minute.

#### The `roundZman` pre-rounding invariant

**Any zman that reaches `roundZman` already at :00 seconds silently loses its
rounding policy** — `roundZman` returns early, so the direction registered for
that zman (up for earliest-permitted times, down for latest-permitted) never
applies. It caused two real bugs:

1. **Havdalah vs tzeis disagreed on the same moment.** hebcal's havdalah event
   arrives pre-rounded to the nearest minute, so "up" never applied to it while
   `tzait` — carrying real seconds — was rounded up as intended. On five of ten
   consecutive Saturdays the two rows of one week card printed different minutes.
   Fixed by sharing the same `Date`: havdalah **is** `tzeit(8.5)`, verified never
   more than 30 s from hebcal's event across all 54 havdalahs in 2026.
2. **"Fast ends" printed a minute lenient.** hebcal's Fast begins/ends event is
   likewise pre-rounded. Tzom Gedaliah 2026-09-14 Toronto: real tzeit(7.083°) =
   20:04:23, hebcal's event 20:04:00 → printed 8:04 PM instead of 8:05 PM, on a
   time that *ends* a fast, on a sheet pinned to a wall. Now hebcal detects
   **whether** it is a fast day; we compute the **times**.

Same trap in `Zmanim.sunriseOffset(minutes, roundMinute)` — the flag is named
"round" but **truncates**. `misheyakir45` passes `false`. `roundZman` owns
rounding; nothing upstream may pre-round.

#### The hebcal upgrade was measured, not assumed

`tests/unit/zmanim-snapshot.test.ts` is a **zero-tolerance** gate: every zman for
366 days × Toronto and Jerusalem, compared to
`tests/fixtures/zmanim-snapshot.json` exactly, including detection of removed
keys. It exists because the change it must catch is exactly one minute — the same
size as the parity fixture's tolerance. **Never regenerate the snapshot to make it
pass.** A diff is a real output change; investigate it, and only regenerate
(`scripts/generate-zmanim-snapshot.ts`) once the new values are understood and
accepted.

Adding `@hebcal/learning@6.9.7` took `@hebcal/core` to 6.9.1. Re-resolved with
the snapshot green — **no zman moved**. `package.json` was also corrected from
`^6.0.6` to `^6.9.1`: the real floor was held only by `@hebcal/learning`'s
transitive dependency, so dropping the daf yomi column (a live fallback at the
time) would have let a fresh install resolve core back down and move every time.

#### Server-timezone relocation

`moladCivilDate` reads UTC parts off `HDate.greg()`, which returns **local**
midnight. Without `anchorCalendarDate()` a positive-offset server puts Sh'vat
5793's molad on 2032-12-25 instead of 2033-01-01 — a full **week** early, because
a zero-distance month (Rosh Chodesh on the molad's own weekday, ~1 month in 28)
turns a one-day slip into a seven-day step back. The unit project is pinned
`TZ=UTC`, so only `describe('resolution is independent of the SERVER timezone')`
in `tests/unit/zmanim-calc.test.ts` can see it; `getZmanimForRange` joined the
same sweep. Both new assertions were verified to go **red** with the
`anchorCalendarDate` calls removed before being trusted.

---

### 2026-08-06 — Google signups were all landing unverified

**Symptom:** a Gmail user (`yael5770@gmail.com`) showed "not verified" in
`/admin/users` immediately after signing in with Google.

**Root cause — Auth.js overwrites `emailVerified`, silently.** The Google
provider's `profile()` in `src/lib/auth/auth.ts` returned
`emailVerified: new Date()` with the comment "Google already verified the
email". That value never reached the database. `@auth/core` hardcodes it away
in `lib/actions/callback/handle-login.js:260`:

```js
user = await createUser({ ...profile, emailVerified: null });
```

The spread puts our value in; the explicit `null` immediately overwrites it.
Deliberate on their side — to Auth.js, `emailVerified` means "we mailed a link
and they clicked it", not "an IdP asserts the address is real" — but nothing
signals that our value was discarded. **The `profile()` return was dead code
for that field.**

**Why it mattered:** `assertCanPost` (`src/lib/auth/require-verified.ts:69`)
refuses every submission from an unverified non-admin. So every Google signup
was silently locked out of all 23 submission endpoints. 5 real accounts were
stuck (ids 12, 14, 23, 3215, 3219).

**Fix — stamp it AFTER the adapter writes the row.** New
`src/lib/auth/oauth-email-verification.ts` (`recordOAuthEmailVerification`),
called from a new `events.linkAccount` in `auth.ts`. `linkAccount` is the one
event that fires on both link-creating paths (new OAuth signup at
handle-login.js:262-264, and an existing session adding a provider at :209) and
it runs before the session is issued.

Key mechanics worth remembering:
- **The mapped `profile()` object survives into the event.** `createUser({...profile, emailVerified: null})` does not mutate `profile`, and
  `events.linkAccount({ user, account, profile })` passes the original. That is
  how the provider's claim reaches the writer — `profile()` now returns
  `emailVerified: profile.email_verified ? new Date() : null`, gated on
  Google's own claim (a Workspace account can report false) rather than
  stamped blindly.
- **`WHERE email_verified IS NULL` is load-bearing.** The legacy import stamped
  ~3,132 accounts with their ORIGINAL signup date and some of those people
  later signed in with Google (ids 8, 11, 20 carry 2015/2021/2022 dates).
  Overwriting would rewrite history.
- **The helper never throws** — it runs mid sign-in, so a failed UPDATE must
  not become a login outage. Logged and swallowed; the user can still fall back
  to `POST /api/auth/resend-verification`.

**Checked and NOT a concern:** `emailVerified` plays no part in Auth.js account
linking. `allowDangerousEmailAccountLinking` is unset, so an OAuth profile whose
email already belongs to a user still throws `OAuthAccountNotLinked` regardless
of verification state (handle-login.js:233-251). Stamping changes nothing there.

**Backfill:** `scripts/backfill-oauth-email-verified.ts` (dry-run default,
`--commit`, `--test`). **Run against primary on 2026-08-06** — 5 accounts
verified using each one's own `created_at` (the moment Google vouched), not
`now()`. All 12 Google-linked accounts are now verified; the three legacy dates
were untouched. Reversal: re-null the 5 ids the dry run prints.

**Tests:** `tests/oauth-email-verification.test.ts`, 6 integration tests
(stamps, string id from the adapter, does not overwrite, no-op when the
provider did not vouch, no-op for `credentials`, never throws). `tsc` 0 errors,
eslint 0 in touched files.

**Not covered by tests:** the `events.linkAccount` wiring itself is config, and
there is no harness for a real Google round trip. Verified by reading the
`@auth/core` source rather than by execution — worth a live Google signup on
the next deploy to confirm end to end.

---

### 2026-08-07 — Eruv status page, and the staleness bug it uncovered

Branch `feature/eruv-page` (worktree `../ft-eruv`), 9 commits, **not merged, not
pushed**. Spec: `docs/superpowers/specs/2026-08-07-eruv-status-page-design.md`.

**State:** 796 unit + 627 integration tests green, `tsc` 0 errors, `npm run
build` green with `/eruv` **ƒ dynamic** and `/zmanim` still **○ static**.

#### What was actually broken

`/eruv` returned 404 and never existed, yet `EruvWidget` linked to it from two
places (`:90` and `:159`). With `eruv_status` empty in production the homepage
showed "Unavailable" **and** a link to a 404. `LiveStrip.tsx:66` carried a
comment noting the page's absence — the hero was worked around, the widget was
not.

The quieter defect: `GET /api/community/eruv` returned the newest row by
`status_date` with **no recency guard**, so a status entered a month earlier
displayed as current. `heroData.ts` carried the same query, with a comment
saying it *deliberately* mirrored the API so the two could not contradict each
other on one page — which meant changing the API required changing it too.

#### The design decision

A status is now stored against **the Shabbos it applies to**, and looked up by
that exact date. A stale status becomes **unrepresentable** rather than
something to detect with a cutoff. Rejected alternatives: an N-day staleness
cutoff, and an always-show-the-age banner.

**Yom Tov is deliberately out of scope** (owner's call). hebcal's `flags.CHAG`
identifies Rosh Hashanah I/II, Yom Kippur, Sukkot I/II, Shmini Atzeret and
Simchat Torah while correctly excluding Chol Hamoed — verified against 2026.
Note Sat 2026-09-26 is both Shabbos and Sukkot I, so any occasion list must
dedupe by date.

#### The fact that shaped the UI

**The eruv is not confirmed until roughly Friday.** So Sunday–Thursday there is
no row for the coming Shabbos, *every week*. The empty state is the page's
NORMAL state, not an exception. Hence "Not yet checked for Shabbos, Aug 15 —
usually confirmed on Friday", with the previous result underneath as **dated**
context, carried in a separate `previous` API field so no consumer can render a
past result as current.

**"Not yet checked" must never render as DOWN.** Same practical caution,
different claim; showing absence as red DOWN is a false statement about the
eruv. Pinned by tests verified to fail against that exact sabotage.

Saturday-night rollover is **midnight Toronto, not tzeis** — since nothing is
entered before Friday, flipping at tzeis would only replace a real status with
"not yet checked" three hours early. No zmanim coupling.

#### Traps this session paid for

- **A timezone sweep can pass against broken code.** The first version used a
  Friday-evening instant: a UTC server misreads it as Saturday, but
  Friday→coming-Saturday and Saturday→itself resolve to the SAME date, so the
  wrong reasoning gave the right answer. It must be a **Saturday evening**
  instant, where the misread rolls to Sunday and changes the result. Copying the
  proven pattern from `zmanim-calc.test.ts` did not transfer its power — the
  *inputs* have to make the bug observable.
- **`vi.useFakeTimers()` and real database calls do not mix.** Fake timers
  replace the `setTimeout` undici uses for socket connect, so Neon queries in the
  same test intermittently `ETIMEDOUT`. Looks exactly like the flaky test branch.
  Fixed by making `now` a parameter of `getCurrentEruvStatus` — better design and
  the actual fix.
- **`ResizeObserver` was missing from `tests/unit-setup.ts`.** Radix's
  popper-backed primitives (Tooltip, Popover, HoverCard) position through
  Floating UI, which observes the trigger. Without it the popup opens then throws
  mid-position, the content never lands in the DOM, and it reads as "the tooltip
  never opened". Now stubbed; any future Popover test would have hit this.
- **`currentShabbos` is NOT `getUpcomingShabbat`.** The latter computes
  `dayOfWeek <= 5 ? 5 - dayOfWeek : 6` (`zmanim.ts:290`), so on Saturday it skips
  to next week. Correct for candle lighting, wrong here.
- **`git worktree add` run from the parent directory** creates a worktree of the
  WRONG repo — `frumtoronto/`'s parent is the separate `Makra-work-files` repo.
- **`pkill -f "next-server"` killed another worktree's dev server.** Match on the
  worktree path, not the binary name.

#### Important Numbers — investigated, not changed

Fully built and working (`/community/important-numbers`, admin at
`/admin/community/important-numbers`). It renders empty **because the table has
0 rows** — pure content gap, no code defect. Legacy MSSQL has no equivalent
table, so there is nothing to import.

It is administered under **Community** but linked publicly under **Alerts ▾**
(`navigation.ts:35`), which is why it could not be found on the site. **The nav
was deliberately left unchanged** (owner's call); a `PublicLocationHint` on both
admin pages now names the public URL and the nav path instead.

Known quirk, unaddressed: `category` is free text with no picker, so "Schools"
and "schools" render as two sections.

#### Open items

- **`/eruv` is not in the main nav** — reachable only via the homepage widget.
  Worth deciding whether it belongs under Alerts ▾.
- The page ships empty until someone enters the first status.
- If Friday updates lapse the page goes quiet rather than wrong, but **nobody is
  nudged**. A reminder is out of scope here.
- The populated (UP/DOWN) state was verified by component and integration tests,
  **not in a browser** — the live check exercised the empty state, which is what
  production is in.
