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
