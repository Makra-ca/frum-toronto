import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { kosherAlerts, users } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";

const submissionSchema = z.object({
  productName: z.string().min(1, "Product name is required").max(200),
  brand: z.string().max(200).optional().nullable(),
  alertType: z.enum(["recall", "status_change", "warning", "update"]).optional().nullable(),
  description: z.string().min(10, "Description must be at least 10 characters"),
  certifyingAgency: z.string().max(200).optional().nullable(),
  effectiveDate: z.string().optional().nullable(),
  issueDate: z.string().optional().nullable(),
});

// GET - Public listing of approved alerts
export async function GET() {
  try {
    const alerts = await db
      .select({
        id: kosherAlerts.id,
        productName: kosherAlerts.productName,
        brand: kosherAlerts.brand,
        alertType: kosherAlerts.alertType,
        description: kosherAlerts.description,
        certifyingAgency: kosherAlerts.certifyingAgency,
        effectiveDate: kosherAlerts.effectiveDate,
        createdAt: kosherAlerts.createdAt,
      })
      .from(kosherAlerts)
      .where(
        and(
          eq(kosherAlerts.isActive, true),
          eq(kosherAlerts.approvalStatus, "approved")
        )
      )
      .orderBy(desc(kosherAlerts.createdAt));

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("[API] Error fetching public kosher alerts:", error);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}

// POST - User submission of new kosher alert
export async function POST(request: NextRequest) {
  const session = await auth();

  // Require login for submissions
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please sign in to submit a kosher alert" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = submissionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const userId = parseInt(session.user.id);

    // Check if user has auto-approve permission
    const [user] = await db
      .select({
        canAutoApproveKosherAlerts: users.canAutoApproveKosherAlerts,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const autoApprove = user?.role === "admin" || user?.canAutoApproveKosherAlerts === true;

    const [newAlert] = await db
      .insert(kosherAlerts)
      .values({
        userId,
        productName: result.data.productName,
        brand: result.data.brand || null,
        alertType: result.data.alertType || null,
        description: result.data.description,
        certifyingAgency: result.data.certifyingAgency || null,
        effectiveDate: result.data.effectiveDate || null,
        issueDate: result.data.issueDate || null,
        approvalStatus: autoApprove ? "approved" : "pending",
        isActive: true,
      })
      .returning();

    return NextResponse.json({
      alert: newAlert,
      message: autoApprove
        ? "Your kosher alert has been published."
        : "Thank you! Your submission will be reviewed by our team.",
    }, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating kosher alert submission:", error);
    return NextResponse.json({ error: "Failed to submit alert" }, { status: 500 });
  }
}
