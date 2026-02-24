import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { alerts, emailSubscribers, users } from "@/lib/db/schema";
import { eq, desc, ilike, or, and, sql, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { resend, EMAIL_FROM } from "@/lib/email/resend";

const alertSchema = z.object({
  alertType: z.string().min(1, "Alert type is required"),
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().min(1, "Content is required"),
  urgency: z.string().default("normal"),
  isPinned: z.boolean().default(false),
  expiresAt: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

// GET - List all alerts with pagination and filters
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
    const urgency = searchParams.get("urgency") || "all";
    const offset = (page - 1) * limit;

    const conditions = [];

    if (search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(or(
        ilike(alerts.title, searchTerm),
        ilike(alerts.content, searchTerm)
      ));
    }

    if (urgency !== "all") {
      conditions.push(eq(alerts.urgency, urgency));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(alerts)
      .where(whereClause);

    const totalCount = Number(countResult?.count || 0);

    // Get alerts with user info
    const results = await db
      .select({
        id: alerts.id,
        userId: alerts.userId,
        alertType: alerts.alertType,
        title: alerts.title,
        content: alerts.content,
        urgency: alerts.urgency,
        isPinned: alerts.isPinned,
        expiresAt: alerts.expiresAt,
        isActive: alerts.isActive,
        createdAt: alerts.createdAt,
        createdByEmail: users.email,
        createdByName: users.firstName,
      })
      .from(alerts)
      .leftJoin(users, eq(alerts.userId, users.id))
      .where(whereClause)
      .orderBy(desc(alerts.isPinned), desc(alerts.createdAt))
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
    console.error("[API] Error fetching alerts:", error);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}

// POST - Create new alert
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sendNotification, ...alertData } = body;

    const result = alertSchema.safeParse(alertData);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const [newAlert] = await db
      .insert(alerts)
      .values({
        userId: parseInt(session.user.id),
        alertType: result.data.alertType,
        title: result.data.title,
        content: result.data.content,
        urgency: result.data.urgency,
        isPinned: result.data.isPinned,
        expiresAt: result.data.expiresAt ? new Date(result.data.expiresAt) : null,
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
            eq(emailSubscribers.communityAlerts, true),
            eq(emailSubscribers.isActive, true),
            isNotNull(emailSubscribers.userId)
          )
        );

      if (subscribers.length > 0) {
        // Send emails in batches
        const batchSize = 50;
        const urgencyLabel = result.data.urgency === "urgent" ? "URGENT: " :
                            result.data.urgency === "high" ? "Important: " : "";

        for (let i = 0; i < subscribers.length; i += batchSize) {
          const batch = subscribers.slice(i, i + batchSize);

          try {
            await resend.batch.send(
              batch.map((sub) => ({
                from: EMAIL_FROM,
                to: sub.email,
                subject: `${urgencyLabel}${result.data.title} - FrumToronto Community Alert`,
                html: getAlertEmailHtml(result.data.title, result.data.content, result.data.urgency, sub.firstName),
              }))
            );
          } catch (emailError) {
            console.error("[API] Error sending alert emails:", emailError);
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
    console.error("[API] Error creating alert:", error);
    return NextResponse.json({ error: "Failed to create alert" }, { status: 500 });
  }
}

function getAlertEmailHtml(title: string, content: string, urgency: string, firstName: string | null): string {
  const urgencyColor = urgency === "urgent" ? "#DC2626" :
                       urgency === "high" ? "#F59E0B" : "#3B82F6";
  const urgencyBg = urgency === "urgent" ? "#FEE2E2" :
                    urgency === "high" ? "#FEF3C7" : "#DBEAFE";

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
                <td style="background-color: ${urgencyColor}; padding: 24px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Community Alert</h1>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 32px;">
                  <p style="margin: 0 0 16px 0; color: #6b7280;">
                    ${firstName ? `Hi ${firstName},` : 'Hi,'}
                  </p>

                  <div style="background-color: ${urgencyBg}; border-left: 4px solid ${urgencyColor}; padding: 16px; margin: 24px 0; border-radius: 4px;">
                    <h2 style="margin: 0 0 12px 0; color: ${urgencyColor}; font-size: 18px;">${title}</h2>
                    <p style="margin: 0; color: #374151; white-space: pre-wrap;">${content}</p>
                  </div>

                  <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px;">
                    This is an automated community alert from FrumToronto.
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
