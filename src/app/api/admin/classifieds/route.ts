import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { classifieds, classifiedCategories } from "@/lib/db/schema";
import { desc, eq, and, or, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { fromDateTimeInputs } from "@/lib/datetime";

/** A `YYYY-MM-DD` from a date input, read as end of that day in Toronto. */
function fromDateInput(value: string): Date | null {
  const iso = fromDateTimeInputs(value, "23:59");
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 86_400_000);
}

// GET - List all classifieds with pagination and filtering
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") || "all";
    const search = searchParams.get("search") || "";
    const offset = (page - 1) * limit;

    const conditions = [];

    // Status filter
    if (status !== "all") {
      conditions.push(eq(classifieds.approvalStatus, status));
    }

    // Search filter
    if (search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(classifieds.title, searchTerm),
          ilike(classifieds.description, searchTerm),
          ilike(classifieds.location, searchTerm)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get entries with category name
    const entries = await db
      .select({
        id: classifieds.id,
        title: classifieds.title,
        description: classifieds.description,
        price: classifieds.price,
        priceType: classifieds.priceType,
        contactName: classifieds.contactName,
        contactEmail: classifieds.contactEmail,
        contactPhone: classifieds.contactPhone,
        location: classifieds.location,
        imageUrl: classifieds.imageUrl,
        isSpecial: classifieds.isSpecial,
        expiresAt: classifieds.expiresAt,
        approvalStatus: classifieds.approvalStatus,
        viewCount: classifieds.viewCount,
        isActive: classifieds.isActive,
        categoryId: classifieds.categoryId,
        categoryName: classifiedCategories.name,
        createdAt: classifieds.createdAt,
      })
      .from(classifieds)
      .leftJoin(classifiedCategories, eq(classifieds.categoryId, classifiedCategories.id))
      .where(whereClause)
      // updated_at, not created_at: a correction to an older item has to
      // surface. Ordering by creation buries an edited 2023 simcha under
      // 16,000 rows, which makes the feature unusable in the case it was
      // built for. The id tiebreaker matters because imported content
      // shares timestamps in bulk.
      .orderBy(desc(classifieds.updatedAt), desc(classifieds.id))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(classifieds)
      .where(whereClause);

    const totalCount = Number(countResult?.count || 0);

    return NextResponse.json({
      entries,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("[API] Error fetching classifieds:", error);
    return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
  }
}

// POST - Admin creates a classified directly.
//
// Mirrors the admin "+ New" that simchas, shiva and tehillim already have:
// an admin is the approver, so making them approve their own listing is
// busywork. Auto-approved, and broadcast_at is stamped so the submissions
// system treats it as already announced and never emails it later.
//
// Classifieds are the only in-scope type that EXPIRES. The default matches the
// public submit form (30 days, api/community/classifieds/route.ts:65), but the
// form exposes the date — 1,663 approved listings are invisible today purely
// because their expires_at passed, and a fixed default hides exactly that.
const createSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z
    .string()
    .min(1, "Description is required")
    .max(2000, "Description must be 2,000 characters or less"),
  price: z.string().optional().nullable(),
  priceType: z.enum(["fixed", "negotiable", "free"]).optional().nullable(),
  contactName: z.string().max(100).optional().nullable(),
  contactEmail: z.string().max(255).optional().nullable(),
  contactPhone: z.string().max(40).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  categoryId: z.number().optional().nullable(),
  isSpecial: z.boolean().optional(),
  /** Omit for the 30-day default. */
  expiresAt: z.string().optional().nullable(),
});

const DEFAULT_RUN_DAYS = 30;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = createSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }
    const { expiresAt, ...data } = result.data;

    const expiry = expiresAt
      ? fromDateInput(expiresAt)
      : addDays(new Date(), DEFAULT_RUN_DAYS);

    if (!expiry) {
      return NextResponse.json(
        { error: "Expiry date is not a valid date" },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(classifieds)
      .values({
        ...data,
        userId: parseInt(session.user.id),
        approvalStatus: "approved",
        isActive: true,
        expiresAt: expiry,
        // Already public the moment it is created, so it has had its one
        // announcement. Leaving this null would let a later approval announce
        // a listing that has been live for weeks.
        broadcastAt: new Date(),
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating classified:", error);
    return NextResponse.json(
      { error: "Failed to create classified" },
      { status: 500 }
    );
  }
}
