import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { kosherAlerts, emailSubscribers, users } from "@/lib/db/schema";
import { eq, desc, ilike, or, and, sql, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { resend, EMAIL_FROM } from "@/lib/email/resend";

const kosherAlertSchema = z.object({
  productName: z.string().min(1, "Product name is required").max(200),
  brand: z.string().max(200).optional().nullable(),
  alertType: z.string().optional().nullable(),
  description: z.string().min(1, "Description is required"),
  certifyingAgency: z.string().max(200).optional().nullable(),
  effectiveDate: z.string().optional().nullable(),
  issueDate: z.string().optional().nullable(),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).default("approved"),
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
      .orderBy(desc(kosherAlerts.createdAt))
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

    // Send email notifications if requested
    if (sendNotification && resend) {
      const subscribers = await db
        .select({
          email: emailSubscribers.email,
          firstName: emailSubscribers.firstName,
        })
        .from(emailSubscribers)
        .where(
          and(
            eq(emailSubscribers.kosherAlerts, true),
            eq(emailSubscribers.isActive, true),
            isNotNull(emailSubscribers.userId)
          )
        );

      if (subscribers.length > 0) {
        const batchSize = 50;

        for (let i = 0; i < subscribers.length; i += batchSize) {
          const batch = subscribers.slice(i, i + batchSize);

          try {
            await resend.batch.send(
              batch.map((sub) => ({
                from: EMAIL_FROM,
                to: sub.email,
                subject: `Kosher Alert: ${result.data.productName} - FrumToronto`,
                html: getKosherAlertEmailHtml(newAlert, sub.firstName),
              }))
            );
          } catch (emailError) {
            console.error("[API] Error sending kosher alert emails:", emailError);
          }
        }
      }

      return NextResponse.json({
        alert: newAlert,
        notificationsSent: subscribers.length
      }, { status: 201 });
    }

    return NextResponse.json({ alert: newAlert }, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating kosher alert:", error);
    return NextResponse.json({ error: "Failed to create alert" }, { status: 500 });
  }
}

function getKosherAlertEmailHtml(alert: {
  productName: string;
  brand: string | null;
  alertType: string | null;
  description: string;
  certifyingAgency: string | null;
  effectiveDate: string | null;
}, firstName: string | null): string {
  const alertTypeLabel = alert.alertType === "recall" ? "RECALL" :
                         alert.alertType === "status_change" ? "Status Change" :
                         alert.alertType === "warning" ? "Warning" : "Update";

  const alertColor = alert.alertType === "recall" ? "#DC2626" :
                     alert.alertType === "warning" ? "#F59E0B" : "#3B82F6";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <!-- Header -->
              <tr>
                <td style="background-color: ${alertColor}; padding: 24px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Kosher Alert: ${alertTypeLabel}</h1>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 32px;">
                  <p style="margin: 0 0 16px 0; color: #6b7280;">
                    ${firstName ? `Hi ${firstName},` : 'Hi,'}
                  </p>

                  <p style="margin: 0 0 24px 0; color: #374151;">
                    This is an important kosher alert from FrumToronto:
                  </p>

                  <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
                    <h2 style="margin: 0 0 12px 0; color: #111827; font-size: 20px;">
                      ${alert.productName}
                    </h2>
                    ${alert.brand ? `<p style="margin: 0 0 8px 0; color: #6b7280;"><strong>Brand:</strong> ${alert.brand}</p>` : ''}
                    ${alert.certifyingAgency ? `<p style="margin: 0 0 8px 0; color: #6b7280;"><strong>Certifying Agency:</strong> ${alert.certifyingAgency}</p>` : ''}
                    ${alert.effectiveDate ? `<p style="margin: 0 0 8px 0; color: #6b7280;"><strong>Effective Date:</strong> ${alert.effectiveDate}</p>` : ''}
                    <p style="margin: 16px 0 0 0; color: #374151; white-space: pre-wrap;">${alert.description}</p>
                  </div>

                  <p style="margin: 0; color: #6b7280; font-size: 14px;">
                    Please consult your Rabbi for any halachic questions.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; color: #6b7280; font-size: 14px;">
                    FrumToronto Community
                  </p>
                  <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 12px;">
                    You can update your notification preferences in your account settings.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}
