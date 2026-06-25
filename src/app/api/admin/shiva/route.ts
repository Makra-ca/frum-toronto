import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shivaNotifications } from "@/lib/db/schema";
import { desc, eq, and, or, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { sendShivaNoticeEmail } from "@/lib/email/send";

const createSchema = z.object({
  niftarName: z.string().trim().min(1, "Niftar name is required").max(200),
  niftarNameHebrew: z.string().trim().max(200).optional().nullable(),
  mournerNames: z.array(z.string()).optional(),
  shivaAddress: z.string().trim().max(500).optional().nullable(),
  shivaStart: z.string().min(1, "Start date is required"),
  shivaEnd: z.string().min(1, "End date is required"),
  shivaHours: z.string().trim().max(200).optional().nullable(),
  daveningTimes: z.string().trim().optional().nullable(),
  levayaInfo: z.string().trim().optional().nullable(),
  zoomInfo: z.string().trim().optional().nullable(),
  minyanInfo: z.string().trim().optional().nullable(),
  attachmentUrl: z.string().max(500).optional().nullable(),
  mealInfo: z.string().trim().optional().nullable(),
  donationInfo: z.string().trim().optional().nullable(),
  contactPhone: z.string().trim().max(40).optional().nullable(),
});

// GET - List all shiva notices with pagination and filtering
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
      conditions.push(eq(shivaNotifications.approvalStatus, status));
    }

    // Search filter
    if (search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(shivaNotifications.niftarName, searchTerm),
          ilike(shivaNotifications.niftarNameHebrew, searchTerm),
          ilike(shivaNotifications.shivaAddress, searchTerm)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get entries
    const entries = await db
      .select()
      .from(shivaNotifications)
      .where(whereClause)
      .orderBy(desc(shivaNotifications.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(shivaNotifications)
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
    console.error("[API] Error fetching shiva notices:", error);
    return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
  }
}

// POST - Admin creates a shiva notice (auto-approved)
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = createSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const d = result.data;
    const mournerNames = Array.isArray(d.mournerNames)
      ? d.mournerNames.filter((n) => typeof n === "string" && n.trim())
      : [];

    const [created] = await db
      .insert(shivaNotifications)
      .values({
        userId: parseInt(session.user.id),
        niftarName: d.niftarName.trim(),
        niftarNameHebrew: d.niftarNameHebrew?.trim() || null,
        mournerNames,
        shivaAddress: d.shivaAddress?.trim() || null,
        shivaStart: d.shivaStart,
        shivaEnd: d.shivaEnd,
        shivaHours: d.shivaHours?.trim() || null,
        daveningTimes: d.daveningTimes?.trim() || null,
        levayaInfo: d.levayaInfo?.trim() || null,
        zoomInfo: d.zoomInfo?.trim() || null,
        minyanInfo: d.minyanInfo?.trim() || null,
        attachmentUrl: d.attachmentUrl || null,
        mealInfo: d.mealInfo?.trim() || null,
        donationInfo: d.donationInfo?.trim() || null,
        contactPhone: d.contactPhone?.trim() || null,
        approvalStatus: "approved",
      })
      .returning();

    // Admin-created notices are approved → broadcast as-posted (non-fatal).
    try {
      await sendShivaNoticeEmail(created);
    } catch (err) {
      console.error("[SHIVA] Failed to send as-posted broadcast (admin create):", err);
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating shiva notice:", error);
    return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
  }
}
