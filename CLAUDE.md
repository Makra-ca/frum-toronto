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

### 2026-07-29/30 — Legacy MSSQL import: members, simchas, shiva, kosher alerts, blog

Imported the old FrumToronto MSSQL site into Postgres. **~25,700 content rows + 3,052 accounts**, all reconciled against source and re-runnable.

#### Where the legacy data actually lives

The old server (`216.105.90.65`, creds in `.env` as `MSSQL_*`, **read-only**) hosts 6 databases. Two matter:

| What | Source | Rows imported |
|---|---|---|
| Members | `FrumToronto.dbo.MemberList` | 3,052 users / 2,957 subscribers |
| Simchas | `FrumShared.dbo.BlogEntries` cats 114/115/116/117/29 | 16,542 |
| Shiva | same table, cat 85 | 3,553 |
| Kosher alerts | same table, cat 43 | 1,587 |
| Blog | same table, cats 44/96/45 | 3,052 |

**The key structural discovery:** the old site had no simcha/shiva/kosher-alert tables. All three were *blog categories* in one shared `BlogEntries` table (35,007 rows) flagged with `MailerSimchas` / `MailerShiva` / `MailerAlerts`. That is why earlier passes never found them. `FrumToronto.dbo.Members` (12 rows with Admin/SuperAdmin bits) was deliberately **not** imported — creating admin accounts is a security decision, not a migration one.

#### Scripts (`scripts/legacy-import/`)

All are **dry-run by default**; nothing writes without `--commit`. `--limit=N` for a slice, `--repair --commit` to recompute text of already-imported rows in place.

| File | Purpose |
|---|---|
| `lib.ts` | MSSQL connect, OLE-date conversion, HTML→text, target connect, CLI opts |
| `parse.ts` | **Pure** functions only: simcha classifier, shiva name extractor, kosher classifier, HTML sanitizer, slugify |
| `members.ts` / `simchas.ts` / `shiva.ts` / `kosher-alerts.ts` / `blog.ts` | the importers |
| `verify-members.ts` | bcrypt round-trip, opt-out respect, flag round-trip |
| `verify-all.ts` | source-vs-target counts + 22 invariants. **Run this after any re-import.** |

`parse.ts` exists because the runners call `main()` at module scope — importing a runner from a test connected to both live databases as a side effect. Pure logic lives there and is the only thing tests import.

#### Non-obvious decisions (all deliberate)

- **Legacy passwords were plaintext.** Bcrypt-hashed at cost 12 on import (matching `/api/auth/register`), so members keep the password they know. Verified by `bcrypt.compare` against source on a 25-row sample.
- **156 `RemoveMe` members** asked the old site to stop emailing them. They get a user account (login preserved) but **no `email_subscribers` row at all** — absence of the row is what actually guarantees no email. `verify-all.ts` asserts this stays true.
- **`newsletter` is set explicitly from the legacy `Subscribe` flag**, never left to its column default of `true`, which would have opted in ~1,500 people who never subscribed.
- **141 duplicate emails** (177 surplus rows): newest row wins, flags are *not* merged across rows — merging could re-enable something a member turned off.
- **`event_date` on simchas stays NULL.** The legacy row records when the announcement was *posted*, not when the simcha happened. The post date goes to `created_at` (what the page sorts by). Copying it into a calendar-icon field would present an inference as fact.
- **`photo_url` stays NULL.** `BlogPicture`/`BlogPictureURL` are empty on all 16,542 rows; `BlogImage` holds a generic badge filename (`MazelTov.JPG`, `ring.jpg`), not a family photo.
- **Shiva prose had nowhere to go.** `shiva_notifications` models structured logistics; legacy notices are one prose block. Added nullable **`notice_text`** rather than overloading `levaya_info`. `shiva_start` = post date, `shiva_end` = +7 (both NOT NULL, never recorded in source); all are long expired so the `shiva_end >= today` filter keeps them off the public page. Mourner/address/davening fields stay NULL — regexing logistics for real families would fabricate data.
- **Blog keeps its HTML** (that page uses `dangerouslySetInnerHTML`), so it is **sanitized** by `sanitizeLegacyHtml` — the repo has no sanitizer dependency. 28 tests cover script/iframe/`on*`/`javascript:`/`expression()` vectors.
- **12 numbered Q&A rows in Message Board (cat 44) are skipped** — they are Ask-the-Rabbi content that already lives in `ask_the_rabbi` from cat 98. Importing them would duplicate it.
- **Blog authorship:** matched to existing users by legacy email (2,636, mostly `rochel@frumtoronto.com`); the remaining **416 are attributed to `admin@frumtoronto.com` as a placeholder**, not a claim of authorship. Change with an `UPDATE blog_posts SET author_id = ... WHERE old_id IS NOT NULL`.

#### Two real bugs found and fixed

1. **Windows-1252 numeric entities.** The legacy editor stored `’` as `&#146;` — a cp1252 *byte* value, which is an invisible C1 control character in Unicode. `String.fromCodePoint` therefore produced garbage, corrupting **1,168 of 16,542** simcha rows ("Canadas" instead of "Canada’s"). Fixed with a cp1252 table in `safeCodePoint`, plus support for **unterminated** entities (`&#146Mitzvos`, no semicolon) and **double-encoded** rows (`&amp;amp;`, `&lt;br&gt;`) via strip-then-decode to a fixed point. Repaired in place with `simchas.ts --repair --commit`.
2. **`/kosher-alerts` took 46 seconds** after the import — `select()` with no LIMIT under `force-dynamic`, rendering all 1,588 rows per request. Same latent bug `/simchas` had. Both now paginate; kosher-alerts is 1.5s cold / 0.3s warm.

#### Pagination

New reusable **`src/components/ui/PaginationLinks.tsx`** — link-based, for server components (shareable URLs, works without JS, no hydration). `BlogListing.tsx` keeps its client-side version; that page streams over an API.

Applied to `/simchas` (24/page, 690 pages) and `/kosher-alerts` (25/page). Both order by `created_at DESC, id DESC` — **the `id` tiebreaker is required**: many legacy rows share a `created_at`, and without it `OFFSET` paging repeats or skips rows. Out-of-range pages show "That page doesn't exist" with a link back rather than a misleading "nothing here". Admin APIs already paginated (20/page) — unchanged.

#### Migrations (applied to primary)

- `migrations/2026-07-29-legacy-import-old-id.sql` — `old_id` on simchas/shiva/kosher_alerts/blog_posts + **partial UNIQUE indexes** (`WHERE old_id IS NOT NULL`) so duplicate imports are impossible at the DB level, not merely unlikely in script logic. Also a unique index on the long-dormant `email_subscribers.old_member_id` (declared in schema since the first migration, never written to by any code until now) and `idx_simchas_listing`.
- `migrations/2026-07-29-shiva-notice-text.sql` — `notice_text` + `idx_shiva_notifications_window`.

New generic runner `scripts/apply-sql-file.ts <file.sql> [--test]`; it **refuses** files containing DROP/TRUNCATE/DELETE.

#### Known content loss (unavoidable)

Legacy images were served from `www.frumtoronto.com/Local/CalendarImages/` and the old server; **both return 404 today**, so they cannot be preserved or rehosted. Dropped rather than rendered broken: **360** in blog posts, and **13 kosher alerts** whose payload *was* the image (e.g. a Costco Kosher-for-Passover list) are now title-plus-thin-text. Same for `Vaughan Garbage Collection info`.

#### Verification

`verify-all.ts`: all four content counts match source exactly, 22/22 invariants at 0 (no duplicate `old_id`, no markup/entities/control chars in plain-text columns, no `<script>`/`on*`/`javascript:`/`iframe`/dead-image in blog HTML, no empty NOT NULL columns, no orphan FKs, no opted-out member emailable). All five importers re-run to **0 inserts**. Tests **162 → 247** (+85: 33 lib, 24 shiva-name, 28 sanitizer/classifier); `tsc` 0 errors; `eslint` clean on touched files. Pages checked live: `/simchas` (+filter, last page, out-of-range, junk `?page=`), `/kosher-alerts`, `/blog`, `/shiva`, two legacy blog posts.

#### Follow-ups (owner's call)

- **3,052 accounts can now receive email**, carrying legacy opt-ins (1,515 newsletter, 1,227 simchas, 1,684 eruv, 1,929 community alerts). These people opted into the *old* site; some addresses are untouched since 2012. Consider a re-permission email before the first big send, and expect bounces.
- ~~134 shiva names flagged for review~~ — **moot: the 3,553 imported shiva notices were deleted on 2026-07-30** (see the later session note). If they are ever re-imported, the extraction still flags roughly 3.8% of names for review and the dry run prints them.
- 416 blog posts attributed to the admin placeholder.
- `notice_text` is stored but not surfaced in any UI (every legacy notice is expired, so nothing renders it).
- **The Neon test branch credentials no longer authenticate** (`ep-long-band-ahaha6ks`, `.env.test`) — `npm run test:integration` is broken until it is recreated. This import therefore ran against the primary DB with dry-run-by-default as the safety net.
- Still available in the legacy DB, not imported: `Shidduchim`, `BikurCholim`, `CommunityServices`, `WeeklySpecials`, `Advertisements`, `TellAFriendList`, `Raffle`, plus blog cats `Halacha for Today` sibling categories (`Shemiras Halashon` 178, `Thoughts for the Week` 191, `Articles of Interest` 223, `Israel News` 75, and others).

#### Follow-up same session — admin users pagination + imported opt-ins switched off

**Imported opt-ins cleared.** `scripts/legacy-import/set-imported-optins.ts --off --commit` zeroed the 8 broadcast preferences on **2,220** imported subscribers (newsletter/simchas/shiva/kosher_alerts/tehillim/eruv_status/community_alerts/community_events all now 0). Nobody is locked out — they can re-enable themselves at **`/dashboard/settings`** (they kept their old password) or at **`/newsletter/preferences?token=<unsubscribe_token>`** with no login, and that page sets flags to true as well as false. `--restore --commit` re-derives the original flags from the legacy `MemberList`, so this is reversible without a backup. The three *reactive* preferences (`ask_the_rabbi_answered`, `atr_comment_replies`, `blog_comment_notifications`) were deliberately left alone: they only fire in response to something the person posts themselves, so muting them would break a feature rather than respect a consent boundary.

**`/admin/users` was genuinely broken** by the import — 44 rows to 3,146, with `UserTable.tsx` having no search, no filter and no pagination, rendering every row with all 24 permission columns. Now server-side paginated (20/page, 158 pages) with a debounced search (name/email) and a role filter, both driven through the URL so Postgres does the filtering. `/api/admin/users` was rewritten: it takes `page`/`limit`/`search`/`role`, returns `{data, pagination}` like the other admin endpoints, and caps `limit` at 100 so nothing can pull the whole table again.

**Gotcha worth remembering:** `UserTable` seeds local state via `useState(initialUsers)` for optimistic row updates, and React keeps that state across a filter or page change — the new rows would render behind stale state. The page passes `key={page|search|role}` to force a fresh mount per result set.

**A second breakage the import caused:** `UserShulAssignment.tsx` filled its "Select User" dropdown with *every* user via `/api/admin/users`, so it had 3,146 entries — and paginating that API would have silently shrunk it to 20 without any error. Replaced with a debounced type-to-search picker (`?search=&limit=50`) listing up to 50 matches.

**Audited, deliberately not changed:** every other admin API already paginates at 20/page. The remaining unbounded endpoints are all tiny (classified-categories 49, notifications 21, shiurim 10, shul-neighborhoods 8, simcha-types 7, important-numbers/shul-requests/community-newsletters 0), as are the unbounded public pages (`/alerts` 1, `/community/tehillim` 2, `/newsletters` 7, `/shiva` **0 visible** since every legacy notice is expired). `admin/newsletter-segments` was flagged as a risk and then cleared on reading it: it already counts with `COUNT(*)` rather than fetching subscriber rows — it has an N+1 (one count per segment) but that is harmless for an admin-curated list.

**Verification:** `scripts/legacy-import/verify-users-paging.ts` walks all 158 pages and proves exact coverage — 3,146 distinct ids, **0 duplicates**, repeatable ordering, filters agreeing with independent counts, out-of-range pages returning empty. It also reports that **17 `created_at` values are shared by more than one user**, which is the concrete reason the `id` tiebreaker is required rather than merely tidy. Admin pages could not be loaded end-to-end because they sit behind admin auth and no password was available; they were confirmed to compile and guard correctly (307 redirect, API 401). `tsc` 0 errors, 247 tests pass, `eslint` clean on touched files apart from one pre-existing unused-`error` warning in `UserShulAssignment` that predates this work.

#### Follow-up — typing bug in the admin search, and the user picker rebuilt

**Bug: characters disappeared while typing in the `/admin/users` search box.** `UserFilters` echoed the URL back into its controlled input:

```ts
const [search, setSearch] = useState(urlSearch);
useEffect(() => { setSearch(urlSearch); }, [urlSearch]);   // clobbers newer keystrokes
```

Type `ab` → the 300 ms debounce pushes `?search=ab` → the user types `c` so local state is `abc` → the navigation commits, `urlSearch` becomes `ab`, and the sync overwrites `abc` with the stale `ab`. The `c` is gone. `UniversalSearch` never had this because its local `query` is the sole source of truth. Fixed with a `lastPushedSearch` ref: a URL change is adopted only when it differs from what this component pushed, which distinguishes our own echo (ignore) from a real external navigation such as back/forward or the "Clear filters" link (adopt).

**The user dropdown was rebuilt to match the public one.** New `src/components/admin/UserPicker.tsx` follows the `UniversalSearch` pattern — overlay dropdown, 300 ms debounce, **AbortController**, keyboard navigation (↑/↓/Enter/Escape), click-outside dismissal, match highlighting, role badges, combobox ARIA. It replaced the inline result list in `UserShulAssignment`, which had no abort and so could show results for a query the user had already moved past. Editing the text after choosing someone clears the selection, so the dialog can never submit a stale user id while the field displays a different name.

**Component testing now works in this repo.** `@testing-library/react` was already a dependency but `jsdom` was not, which is why there was no component harness. Added `jsdom`, `@testing-library/user-event` and `@testing-library/dom` as dev deps, a `tests/unit-setup.ts` registering the jest-dom matchers, and widened the unit project glob to `*.test.tsx`. Component tests opt into a DOM per file with `// @vitest-environment jsdom`; the default stays `node` so the existing pure tests keep their fast DOM-free environment.

**Both new regression tests were verified to actually fail against the bugs** — and the first two attempts did not, which is the part worth remembering:

- The typing test initially passed even with the bug reintroduced, because the mock applied the new URL *synchronously* inside `router.replace`. That ordering means the extra keystroke lands after the URL echo, so the race never happens. Rewritten so `replace` only records a pending URL and the test calls `commitNavigation()` explicitly, placing the commit after the next keystroke. It now fails on 2 assertions without the fix.
- The AbortController test also passed with the abort removed, because a 500 ms stale response still resolved *before* the newer one given the timeline. Raised to 2000 ms so it genuinely lands last. It now fails without the abort.

A regression test that passes against the broken code is worth nothing; both were checked by reintroducing each bug and confirming a red run.

**Tests 247 → 259.** `tsc` 0 errors; `eslint` clean on touched files except one pre-existing unused-`error` warning in `UserShulAssignment` that predates this work. Admin pages still could not be exercised end-to-end in a browser (admin auth, no password available) — they were confirmed to compile and guard correctly.

#### Follow-up — full-name search returned nothing, and a duplicate clear button

**Bug: `/admin/users?search=danie+makal` found nobody, though three Daniel Makalski accounts exist.** The search put the *whole* query into each column:

```ts
or(ilike(firstName, '%danie makal%'), ilike(lastName, '%danie makal%'), ilike(email, '%danie makal%'))
```

No single column can contain both a first and last name, so every full-name search returned zero. The repo's own convention had it right all along — `searchAskTheRabbi` in `src/lib/search/fuzzy-search.ts` splits the query and requires each word to match *somewhere*: **AND across terms, OR across columns**. `"danie"` hits `first_name`, `"makal"` hits `last_name`, so the row matches.

Fixed in a new shared `src/lib/admin/user-search.ts` (`parseUserSearchTerms` + `buildUserSearchCondition`), used by **both** `/admin/users/page.tsx` and `/api/admin/users` — they had duplicated the query, which is how they would have drifted. Unlike `parseWords` in fuzzy-search, single characters are kept: this is a substring lookup over ~3,150 rows, not trigram similarity, so typing "d" should narrow rather than be dropped (which would show every user and look like the filter was ignored). Terms are capped at 5.

**Bug: two X buttons in the search field.** `type="search"` makes Chromium draw its own clear button, which sat beside the styled one. Changed to `type="text"`. `CategoryFilters.tsx` also uses `type="search"` but has no custom clear button, so it shows only the native one and was left alone.

**Verified live** with `scripts/legacy-import/verify-user-search.ts`, which runs the real drizzle condition against the database (the page is behind admin auth and cannot be curl'd): `"danie makal"`, `"makal danie"` (order-independent), `"  daniel   makalski  "` (whitespace) and `"Daniel Makalski"` all return the same 3 accounts; `"makalski daniel zzz"` correctly returns 0 because one term matches nothing; `""` applies no filter.

Note that script needs `import "dotenv/config"` as its **first** import — `src/lib/db/index.ts` throws at module-evaluation time when `DATABASE_URL` is unset, and imports evaluate in order, so a later `dotenv.config()` runs too late.

**Tests 259 → 272.** The SQL-shape assertions render the condition with `new PgDialect().sqlToQuery(...)` rather than inspecting the drizzle object, which is circular and cannot be JSON-stringified. One asserts the generated params contain `%danie%` and `%makal%` and *not* `%danie makal%` — i.e. the exact shape of the original bug.

#### Follow-up — constant-width pagination, and search on /simchas

**Pagination control was sparse and shifted width.** The old strip showed first + last + current±1, which produced only 4 items on page 1 (`‹ 1 2 … 690 ›` — the sole forward destinations being page 2 or page 690) and swung between 4 and 7 items as you moved. Because the row is centred, that changed its width and moved the Next button out from under the cursor mid-click.

Extracted to pure `src/lib/pagination-items.ts` and rewritten to emit a **constant 7 items** at every position:

```
page   1 of 690 -> 1 2 3 4 5 … 690
page  50 of 690 -> 1 … 49 50 51 … 690
page 690 of 690 -> 1 … 686 687 688 689 690
```

7 rather than 9 so seven `min-w-9` buttons plus `gap-2` (~300px) still fit a 375px phone without wrapping. 13 tests, including the constant-count property asserted across *every* page of lists up to 5,000, plus no-duplicates, strictly-ascending, in-range, and "an ellipsis never hides just one page".

**`/simchas` now has search**, which matters more than any pagination tweak for a 16,550-row archive — nobody finds the Guttman birth notice by clicking through 690 pages. `simchas` is now a `SearchType` in the universal search system (`types.ts`, `searchSimchas()` in `fuzzy-search.ts`, registered in `/api/search/suggestions`), with `SimchasSearchBar` wrapping `UniversalSearch` in the hero using `tone="onDark"`.

- **Filtering is server-side.** `/shuls` and `/shiurim` filter client-side with `useMemo`, which is fine for a few dozen rows; doing that here would ship the whole archive to the browser.
- **`searchSimchas` ranks on `family_name` only** but *matches* the announcement body too, so a grandparent named only in the prose is findable. Ranking on the body as well would flatten the ordering, since `similarity()` over several sentences scores almost everything alike.
- **Suggestions link to `/simchas?search=<family name>`**, not a detail page — there is no `/simchas/[id]` route, so clicking a suggestion narrows the list to that announcement. Adding a detail page would make these deep-linkable and shareable; deliberately not done here.
- `simchas` was **not** added to `searchAll`, so the homepage hero search results are unchanged. Worth considering separately: someone searching "Guttman" from the homepage would reasonably expect the simcha.
- The multi-word matcher from the admin fix was generalised to `src/lib/search/substring-search.ts` (`parseSearchTerms` + `buildSubstringCondition(columns, search)`); `user-search.ts` is now a thin wrapper over it, so the two call sites cannot drift.
- Type filter, pagination and the "clear filters" links all preserve the other parameter, and the empty state distinguishes a failed search from an empty category.

`migrations/2026-07-30-simchas-search-indexes.sql` adds trigram GIN indexes on `family_name` and `announcement` (applied) — without them every keystroke's suggestion query scans all 16,550 rows. A trigram index also serves the `ILIKE '%term%'` the list page uses, which a btree cannot.

**Verified live:** all → 16,550; `Guttman` → 26; `Guttman Jenah` → 2 (multi-word AND narrowing correctly); `Reichmann` → 69; `Reichmann` + `type=engagement` → 20 (filters compose); `zzznothing` → the "No simchas match" state; `?page=99` on a filtered set → "That page doesn't exist". Pagination strips confirmed at 7 items on pages 1, 3, 50 and 690. **Tests 272 → 285.**

#### Follow-up — simcha filter pills redesigned with counts

The type filters were small `<Badge>` chips. Rebuilt as proper pills (`rounded-full`, `px-4 py-2`, `text-sm font-medium`, real border and hover states) each carrying a **result count**, which on a 16,550-row archive turns them from blind guesses into information.

`getTypeCounts(search)` is one extra grouped query. It honours the active **search** but not the active **type** — so each pill shows how many results that type *would* give, which is the only version worth reading. Counts verified against the database: no search → birth 8,683 / engagement 2,902 / wedding 2,686 / bar-mitzvah 2,254 / other 21 / bat-mitzvah 3 / anniversary 1 = 16,550; `Guttman` → 16+5+3+2 = 26; `Guttman Jenah` → 2.

Types with zero results stay visible but render muted rather than being removed, so the row of categories does not reshuffle as the search changes.

**Known issue, not yet fixed (needs a decision):** `UniversalSearch` seeds its input from `initialQuery` only on mount (`useState(initialQuery)`, no sync effect), so after navigating the box can display a query that is no longer applied — e.g. URL `?type=engagement` with no `search=`, count showing all 2,902 engagements, but the box still reading "Buksbaum - Bloom engagement". Also, typing alone does nothing until Enter or a suggestion click, which is unsignposted. The component has ten call sites, so any change there needs care.

#### Follow-up — UniversalSearch fixes, simcha detail pages, simchas in unified search

**`UniversalSearch` no longer shows a query that isn't applied.** It seeded its input from `initialQuery` on mount only, so navigating (e.g. clicking a type filter that drops `?search=`) left the box displaying the old text while the list showed everything. It now syncs when the applied query changes, guarded by an `appliedQueryRef` that records what this component itself submitted — so the sync can tell its own navigation from an external one. All four callers that pass `initialQuery` derive it from the URL and only navigate on submit, so the guard is belt-and-braces; without it, a future caller pushing on a debounce would hit exactly the character-eating bug `UserFilters` had.

Also added: a **"Press Enter to search"** hint, shown only when `onSearch` exists and the box has diverged from what's applied (typing alone never filtered anything, and nothing said so). And `TYPE_LABELS` gained `blog` and `simchas` — **`blog` was already in `searchAll` but had no badge entry**, so blog rows in "all" mode had been rendering unlabelled.

8 component tests; the stale-text one was verified to fail with the sync removed. All 10 call sites checked live for a 200.

**`/simchas/[id]` detail pages exist.** Each announcement now has its own URL, so a family can share theirs. Search suggestions point at the record instead of re-filtering the list, and the list cards link through. The page uses `whitespace-pre-line` so the announcement's paragraph breaks survive (the cards deliberately collapse them), shows up to 4 more of the same type so it isn't a dead end, and sets `generateMetadata` with an OpenGraph description built from the announcement text.

`parseId` rejects anything non-numeric with a regex rather than `Number.parseInt`, which would read `"12abc"` as 12. Detail pages apply the same `isActive` + `approved` filter as the list, so an unapproved announcement can't be reached by guessing an id. Verified: real ids 200; `abc`, `0`, `12abc`, `99999999` all 404.

**Simchas now appear in the homepage/unified search** (`searchAll`).

**Finding while verifying, not a bug:** a simcha-looking result appeared labelled "Blog" — "Lechtman / Arje / Samuels son/grandson/great-grandson". It is *not* a duplicate: `old_id` overlap between `blog_posts` and `simchas` is **0**. That announcement genuinely lived in the old site's Message Board category (`old_id` 23228) rather than in Births. About **32 of 1,354** Message Board posts are simcha-shaped. Left as-is because it reflects where the old site actually put them; the cost is that the occasional simcha shows up as a "Blog" result.

**Tests 285 → 293.**

#### Follow-up — search on /kosher-alerts

1,586 alerts going back to 2006 with no way to search them, when "is this product still OK?" is the main question the page answers. `kosher-alerts` is now a `SearchType` with `searchKosherAlerts()` (registered in the suggestions API, badge added to `TYPE_LABELS`) and `KosherAlertsSearchBar` in the hero.

Ranking is on **product name**, with brand as a weaker secondary signal (×0.8). Agency and description are *matched* but not ranked — the description runs to paragraphs and `similarity()` over that much text scores nearly everything alike, which would flatten the order. Suggestion subtitles show `brand · agency`, which is what actually disambiguates two alerts about the same product.

List filtering is server-side via the shared `buildSubstringCondition` across product name, brand, agency and description, so `"Passover Costco"` matches a row where the words live in different columns. Search is preserved across pagination and the empty state distinguishes a failed search from no alerts.

`migrations/2026-07-30-kosher-alerts-search-indexes.sql` (applied) adds trigram GIN indexes on all four searched columns.

**Verified live:** suggestions — `Folgers` → 3 with `[OU]`, `Costco` → 3, `COR` → 3, `zzznothing` → 0. List — all 1,586; `Folgers` → 1; `Passover Costco` → 2 (multi-word AND working); `zzznothing` → the "No alerts match" state.

Deliberately **not** added to `searchAll`: a recall notice surfacing in the homepage hero alongside businesses and shuls is a judgement call about prominence, not a technical one. Say so and it is a one-line change.

**Still outstanding from this round:** converting `/shuls`, `/shiurim` and `/community/calendar` from client-side `useMemo` filtering to server-side. They work correctly today at 14 / 10 / 91 rows — the concern is purely that they degrade as those tables fill. Also proposed but not approved: text search on `/blog` (3,051 posts, category filter only; `searchBlog` already exists so only a `search` param on `/api/blog` and a box in `BlogListing` are missing).

### 2026-07-30 (later) — shiva notices deleted, test branch restored, blog + kosher search

**The 3,553 imported shiva notices were deleted** at Daniel's instruction. They had no value and were doing harm: all were long expired so the public page (which filters `shiva_end >= today`) showed **0** of them; their prose sat in `notice_text` which **nothing renders**; and because the shiva import did not carry the original post date into `created_at` (unlike the simcha import), all 3,553 took the import timestamp and sorted to the top of the admin queue, **burying the one real notice**.

They are also the most sensitive data in the whole import — bereavement details, mourner names, home addresses in the prose — which makes indefinite retention with no product purpose the weakest case of anything imported.

`scripts/legacy-import/delete-imported-shiva.ts` (dry-run by default) does it. Its `WHERE old_id IS NOT NULL` can by construction only match imported rows, it refuses to run if any imported notice is still inside its shiva window, and it aborts as a failure if the native count changes. Result: 3,554 → 1, the native notice intact. **Fully reversible:** the legacy MSSQL DB is untouched and `npx tsx scripts/legacy-import/shiva.ts --commit` restores all 3,553. The `notice_text` column was kept so a re-import needs no migration.

**Neon test branch replaced and integration tests work again.** New endpoint `ep-curly-union-ah4r8uel` in `.env.test`, and the guard in `tests/setup.ts` was updated to match — that constant is what aborts the run if the tests ever point at production, so it has to track the branch. The branch is a fresh copy of prod, so all migrations were already present. **44 integration tests pass** (they had been unrunnable). `.env.test` is gitignored, so the credential is not in the repo.

**`/blog` gained text search.** `/api/blog` accepts `search`, filtered with the shared `buildSubstringCondition` over title, excerpt **and body**. The body matters here: legacy titles are frequently just a date ("Halacha For Today: Monday, 27 Cheshvan 5773"), so title-only search would miss nearly all 1,211 of those posts. `BlogListing` got a `UniversalSearch` box that resets to page 1 on a new query. Trigram indexes applied via `migrations/2026-07-30-blog-search-indexes.sql`. Verified: 3,051 total → `Purim` 164, `Hashovas Aveidah` 44 (multi-word), `Rosh Chodesh` 484, `zzznothing` 0.

**`kosher-alerts` added to `searchAll`**, so recalls surface in the homepage hero. Verified: `Folgers` returns the kosher alert alongside other types.

**Known quality issue, pre-existing and now more visible:** `searchAll` assigns `relevanceScore: 1000 - index * 10` **per type**, so the top hit of every type scores 1000. Sorting by that interleaves types arbitrarily — a weak fuzzy match from Ask the Rabbi ranks level with an exact product-name match from kosher alerts. With nine types now feeding it, homepage results contain visible noise. Fixing it needs cross-type score normalisation.

**Tests: 293 unit + 44 integration = 337.** `tsc` 0 errors.

### PARKED — legacy-import follow-ups to resume later

**Needs Daniel's decision:**
1. **Blog authorship** — 416 legacy posts credit `admin@frumtoronto.com` as a placeholder. Real legacy authors: `aaron@frumtoronto.com`, `sara@frumtoronto.com`, `halachafortoday@yahoo.com` — none have accounts. Options offered: create accounts for those three, credit all to Rochel (user id 9), or leave as admin. Then one `UPDATE blog_posts SET author_id = … WHERE old_id IS NOT NULL`.
2. **Imported-account logins.** 2,845 of 2,957 imported members can log in right now with their old password — `authorize()` checks only password hash, `isActive` and the bcrypt match; **there is no email-verification gate**. Two consequences worth a decision: those passwords came from a database that stored them in **plaintext** for years, so a forced reset on first login is worth considering; and the 112 who cannot log in (96 legacy `Active = 0`, 16 with no password) get a generic "invalid credentials" error with no hint to try forgot-password.

**Approved but not built:**
3. **Convert `/shuls`, `/shiurim`, `/community/calendar` to server-side filtering.** Currently client-side `useMemo`. Correct today at 14 / 10 / 91 rows; purely a future-degradation concern. Reuse the `/simchas` pattern: server `searchParams` → `buildSubstringCondition` → `PaginationLinks`.

**Optional cleanup:**
4. `searchAll` relevance normalisation (see the known quality issue above).

**Accepted quirks, no action intended:** ~32 of 1,354 Message Board posts are simcha announcements, so the odd simcha appears tagged "Blog" in search (not duplicated — `old_id` overlap with `simchas` is 0; the old site filed them there). Legacy images are permanently 404, so 360 blog images and 13 image-only kosher alerts are thin.

#### Follow-up — what isActive and emailVerified actually do, plus the blocked-user filter

Two user fields were traced end to end because their behaviour was not obvious.

**`isActive` is the ban flag.** Read in exactly three places: `auth.ts:127` (password login → `return null`), `auth.ts:37` (Google `signIn` → `return false`), and `notifications.ts:42` (inactive admins stop receiving admin notifications). It blocks **both** sign-in paths, and the code's own comment calls it "banned". The admin table's "Active" switch is therefore the block/unblock control, and it already worked — `/api/admin/users/[id]` accepts `isActive`.

**`emailVerified` is decorative.** It is *written* in three places (the verify-email route, Google sign-in, the admin "Verify" button) and **read by nothing that controls access**. Login does not check it; no route or page checks it. An unverified user has identical access to a verified one — someone can register with a fake address, never click the link, and use the site normally. Currently **66 of 3,146** accounts are verified.

**New: an account-status filter on `/admin/users`** (All / Active / Blocked, with the blocked count shown on the option). Blocking already worked; the missing piece was *finding* blocked accounts among 3,146 users across 158 pages. `buildUserStatusCondition` lives beside the search helper so the page and API cannot diverge.

That helper deliberately treats **NULL `is_active` as active**, because both the login check (`if (!user.isActive)`) and the admin UI (`user.isActive ?? true`) do. "Blocked" means explicitly `false`.

**98 accounts are blocked: 96 from the legacy import, and 2 that predate it** — a distinction that matters, since a blanket "activate everything" would un-ban two genuine blocks. `scripts/legacy-import/verify-blocked-users.ts` lists them with legacy ids. Evidence that the 96 were not real bans: none flagged, all had working passwords, 83 of 101 created in 2010, and ids 1139–1148 are ten *consecutive* legacy signups deactivated together — a bulk event, not 96 decisions. Still Daniel's call; nothing was changed.

**Forgot-password dead ends fixed.** Previously a disabled account received a reset email, reset successfully, and still could not log in (the reset never touches `is_active`) — and the 16 password-less legacy accounts were told "check your email" while the OAuth-only guard silently sent nothing. Now: a disabled account gets an explicit 403 "this account has been disabled, please contact us", and a password-less account is allowed to reset **only when it has no OAuth link** — which distinguishes a legacy import from a genuine Google-only account, whose takeover the guard exists to prevent.

**A reset deliberately does NOT reactivate.** That was the original suggestion here and it was wrong: since `isActive = false` is the ban, letting a reset clear it would let anyone banned un-ban themselves from the forgot-password form.

**`createTestUser` was silently overriding two fields** — it hardcoded `isActive: true` and turned an explicit `passwordHash: null` into the default hash via `||`, so a test could not construct a blocked or password-less account at all. Now `isActive: userData.isActive ?? true` and an `=== undefined` check on the hash. This is what made the first run of the new tests fail for the wrong reason.

**Tests: 293 unit + 50 integration = 343.**

#### 2026-07-30 — verification gate, imported-member verification, blog authorship resolved

**Imported members exported and marked verified.** `scripts/legacy-import/export-imported-members.ts` wrote `imported-members.txt` (3,117 lines: 2,957 linked members + 145 probable opt-outs) **before** any state changed, so the cohort stays identifiable and the change is reversible from the snapshot. The file is **gitignored deliberately** — a private repo still makes committed PII effectively permanent in history.

`scripts/legacy-import/verify-imported-members.ts` then marked them verified, using their **legacy signup date** rather than `now()`, so the record says "this address was on file since then" instead of implying they clicked a link today. Two passes were needed: members with a subscriber row (identified by `old_member_id`), plus the 148 email opt-outs who have a user account but *no* subscriber row and therefore no `old_member_id` — those are matched by email against `MemberList`. Only `email_verified IS NULL` rows are touched.

Result: **3,121 of 3,146 verified**. The remaining 25 are genuine new signups, which is exactly who the gate should catch.

**Blog authorship resolved.** The 416 admin-placeholder posts broke down as 283 with no author email at all (272 empty + 11 NULL), 123 from `benolamhaba@koshernet.com`, and 10 one-offs. Per Daniel: real authors get credit and stay published; the unattributed ones stay unpublished pending a conversation with the client. `scripts/legacy-import/fix-blog-authorship.ts` created 11 accounts (no password, no subscriber row — nothing emailed, nobody can log in until they use forgot-password), reassigned 133 posts, and set `is_active = false` on the 283. The re-publish SQL is printed by the script.

**An earlier claim here was wrong:** `aaron@`, `sara@` and `halachafortoday@` were said to have no accounts. They do — the member import created them and the blog import matched them correctly (133, 5 and 1,011 posts respectively). The placeholder was never about them.

**Submissions now require a verified email.** `assertCanPost()` in `src/lib/auth/require-verified.ts` is applied to all **22** submission endpoints — public content, comments/shoutouts and business/shul applications. Admins are exempt.

Three deliberate design points:
- It reads `email_verified` from the **database, not the JWT**. `emailVerified` is not in the token, and putting it there would go stale — someone who verified mid-session would keep being refused until their token refreshed, which is the same dead end this work exists to remove.
- It also re-checks `is_active`, because a session can outlive a block.
- It does **not** import `auth`. Callers pass `session.user.id`, which avoids a second JWT verification per request and keeps the module importable in tests without dragging next-auth into a non-Next environment. (The first version did import it, and the tests could not load at all.)

**`POST /api/auth/resend-verification` was a prerequisite, not a nicety.** The verification email had only ever been sent once, at registration — there was no resend anywhere in the codebase. Gating on verification without it would have permanently stranded anyone who lost that email. The route requires a session (an endpoint that mails an arbitrary address is a spam relay), replaces outstanding tokens so only the newest link works, enforces a 2-minute cooldown, and awaits the send because serverless functions can terminate as soon as the response is sent.

**`createTestUser` was silently dropping fields twice.** It ignored `emailVerified` entirely (so every test user looked unverified, which is why the gate tests first failed), on top of the earlier `isActive`/`passwordHash` overrides. Both fixed.

**Tests: 293 unit + 58 integration = 351.** `tsc` 0 errors.

**Still open:** the 283 unattributed blog posts await the client conversation; `/shuls`, `/shiurim`, `/community/calendar` still need the server-side conversion (approved, with search + pagination); and `classifieds/[id]/contact` has **no authentication at all**, which the verification gate does not address.
