import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { kosherAlerts, emailSubscribers } from "@/lib/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { resend, EMAIL_FROM } from "@/lib/email/resend";

const updateSchema = z.object({
  productName: z.string().min(1).max(200).optional(),
  brand: z.string().max(200).optional().nullable(),
  alertType: z.string().optional().nullable(),
  description: z.string().min(1).optional(),
  certifyingAgency: z.string().max(200).optional().nullable(),
  effectiveDate: z.string().optional().nullable(),
  issueDate: z.string().optional().nullable(),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
  isActive: z.boolean().optional(),
});

// GET - Get single kosher alert
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const alertId = parseInt(id);

    const [alert] = await db
      .select()
      .from(kosherAlerts)
      .where(eq(kosherAlerts.id, alertId))
      .limit(1);

    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    return NextResponse.json(alert);
  } catch (error) {
    console.error("[API] Error fetching kosher alert:", error);
    return NextResponse.json({ error: "Failed to fetch alert" }, { status: 500 });
  }
}

// PATCH - Update kosher alert
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const alertId = parseInt(id);
    const body = await request.json();
    const { sendNotification, ...updateData } = body;

    const result = updateSchema.safeParse(updateData);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    // Get current alert to check if status changed to approved
    const [currentAlert] = await db
      .select()
      .from(kosherAlerts)
      .where(eq(kosherAlerts.id, alertId))
      .limit(1);

    if (!currentAlert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    const wasNotApproved = currentAlert.approvalStatus !== "approved";
    const isNowApproved = result.data.approvalStatus === "approved";

    const [updated] = await db
      .update(kosherAlerts)
      .set(result.data)
      .where(eq(kosherAlerts.id, alertId))
      .returning();

    // Send notifications if:
    // 1. Explicitly requested with sendNotification flag, OR
    // 2. Status changed from non-approved to approved (new user submission being approved)
    const shouldNotify = sendNotification || (wasNotApproved && isNowApproved);

    if (shouldNotify && resend) {
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
        const alertTypeLabel = updated.alertType === "recall" ? "RECALL" :
                               updated.alertType === "status_change" ? "Status Change" :
                               updated.alertType === "warning" ? "Warning" : "Update";

        for (let i = 0; i < subscribers.length; i += batchSize) {
          const batch = subscribers.slice(i, i + batchSize);

          try {
            await resend.batch.send(
              batch.map((sub) => ({
                from: EMAIL_FROM,
                to: sub.email,
                subject: `Kosher Alert: ${updated.productName} - FrumToronto`,
                html: getKosherAlertEmailHtml(updated, sub.firstName, alertTypeLabel),
              }))
            );
          } catch (emailError) {
            console.error("[API] Error sending kosher alert emails:", emailError);
          }
        }

        return NextResponse.json({
          alert: updated,
          notificationsSent: subscribers.length
        });
      }
    }

    return NextResponse.json({ alert: updated });
  } catch (error) {
    console.error("[API] Error updating kosher alert:", error);
    return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
  }
}

// DELETE - Delete kosher alert
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const alertId = parseInt(id);

    const [deleted] = await db
      .delete(kosherAlerts)
      .where(eq(kosherAlerts.id, alertId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error deleting kosher alert:", error);
    return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 });
  }
}

function getKosherAlertEmailHtml(alert: {
  productName: string;
  brand: string | null;
  alertType: string | null;
  description: string;
  certifyingAgency: string | null;
  effectiveDate: string | null;
}, firstName: string | null, alertTypeLabel: string): string {
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
