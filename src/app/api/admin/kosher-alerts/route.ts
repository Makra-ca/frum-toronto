import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { kosherAlerts, users } from "@/lib/db/schema";
import { eq, desc, ilike, or, and, sql } from "drizzle-orm";
import { z } from "zod";
import { sendKosherAlertBroadcast } from "@/lib/email/send";
import { APPROVAL_STATUSES } from "@/lib/submissions/statuses";

const kosherAlertSchema = z.object({
  productName: z.string().min(1, "Product name is required").max(200),
  brand: z.string().max(200).optional().nullable(),
  alertType: z.string().optional().nullable(),
  description: z.string().min(1, "Description is required"),
  certifyingAgency: z.string().max(200).optional().nullable(),
  effectiveDate: z.string().optional().nullable(),
  issueDate: z.string().optional().nullable(),
  approvalStatus: z.enum(APPROVAL_STATUSES).default("approved"),
  isActive: z.boolean().default(true),
});

// GET - List all kosher alerts with pagination and filters
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const alertType = searchParams.get("alertType") || "all";
    const offset = (page - 1) * limit;

    const conditions = [];

    if (search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(or(
        ilike(kosherAlerts.productName, searchTerm),
        ilike(kosherAlerts.brand, searchTerm),
        ilike(kosherAlerts.description, searchTerm)
      ));
    }

    if (status !== "all") {
      conditions.push(eq(kosherAlerts.approvalStatus, status));
    }

    if (alertType !== "all") {
      conditions.push(eq(kosherAlerts.alertType, alertType));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(kosherAlerts)
      .where(whereClause);

    const totalCount = Number(countResult?.count || 0);

    // Get alerts with user info
    const results = await db
      .select({
        id: kosherAlerts.id,
        userId: kosherAlerts.userId,
        productName: kosherAlerts.productName,
        brand: kosherAlerts.brand,
        alertType: kosherAlerts.alertType,
        description: kosherAlerts.description,
        certifyingAgency: kosherAlerts.certifyingAgency,
        effectiveDate: kosherAlerts.effectiveDate,
        issueDate: kosherAlerts.issueDate,
        approvalStatus: kosherAlerts.approvalStatus,
        isActive: kosherAlerts.isActive,
        createdAt: kosherAlerts.createdAt,
        submittedByEmail: users.email,
        submittedByName: users.firstName,
      })
      .from(kosherAlerts)
      .leftJoin(users, eq(kosherAlerts.userId, users.id))
      .where(whereClause)
      // updated_at, not created_at: a correction to an older item has to
      // surface. Ordering by creation buries an edited 2023 simcha under
      // 16,000 rows, which makes the feature unusable in the case it was
      // built for. The id tiebreaker matters because imported content
      // shares timestamps in bulk.
      .orderBy(desc(kosherAlerts.updatedAt), desc(kosherAlerts.id))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      alerts: results,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("[API] Error fetching kosher alerts:", error);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}

// POST - Create new kosher alert (admin)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sendNotification, ...alertData } = body;

    const result = kosherAlertSchema.safeParse(alertData);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const [newAlert] = await db
      .insert(kosherAlerts)
      .values({
        userId: parseInt(session.user.id),
        productName: result.data.productName,
        brand: result.data.brand || null,
        alertType: result.data.alertType || null,
        description: result.data.description,
        certifyingAgency: result.data.certifyingAgency || null,
        effectiveDate: result.data.effectiveDate || null,
        issueDate: result.data.issueDate || null,
        approvalStatus: "approved", // Admin-created alerts are auto-approved
        isActive: result.data.isActive,
      })
      .returning();

    // Send email notifications if requested.
    //
    // broadcast_at is stamped here too, so this alert can never be announced a
    // second time — including via a later edit → pending_edit → re-approval,
    // which setApprovalStatus gates on exactly that column.
    if (sendNotification) {
      const notificationsSent = await sendKosherAlertBroadcast(newAlert);
      if (notificationsSent > 0) {
        await db
          .update(kosherAlerts)
          .set({ broadcastAt: new Date() })
          .where(eq(kosherAlerts.id, newAlert.id));
      }
      return NextResponse.json(
        { alert: newAlert, notificationsSent },
        { status: 201 }
      );
    }

    return NextResponse.json({ alert: newAlert }, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating kosher alert:", error);
    return NextResponse.json({ error: "Failed to create alert" }, { status: 500 });
  }
}
