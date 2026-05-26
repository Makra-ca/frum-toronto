import { resend, EMAIL_FROM } from "./resend";
import { getVerificationEmailHtml, getPasswordResetEmailHtml } from "./templates";
import { db } from "@/lib/db";
import { emailSubscribers } from "@/lib/db/schema";
import { and, eq, isNotNull, sql } from "drizzle-orm";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  if (!resend) {
    console.error("Resend client not initialized - cannot send verification email");
    return false;
  }

  const verificationUrl = `${APP_URL}/verify-email?token=${token}`;

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Verify your email - FrumToronto",
      html: getVerificationEmailHtml(verificationUrl),
    });

    if (error) {
      console.error("Failed to send verification email:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending verification email:", error);
    return false;
  }
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
  if (!resend) {
    console.error("Resend client not initialized - cannot send password reset email");
    return false;
  }

  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Reset your password - FrumToronto",
      html: getPasswordResetEmailHtml(resetUrl),
    });

    if (error) {
      console.error("Failed to send password reset email:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return false;
  }
}

// ============================================
// EVENT EMAIL HELPERS
// ============================================

function formatEventDate(startTime: Date | null): string {
  if (!startTime) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(startTime);
}

function formatEventTime(startTime: Date | null, isAllDay: boolean | null): string {
  if (!startTime) return "";
  if (isAllDay) return "All Day";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(startTime);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

type EventRow = {
  id: number;
  title: string;
  description?: string | null;
  location?: string | null;
  startTime: Date;
  endTime?: Date | null;
  isAllDay?: boolean | null;
  eventType?: string | null;
  cost?: string | null;
  organization?: string | null;
  flyerUrl?: string | null;
  websiteUrl?: string | null;
};

function buildEventLiveEmailHtml(event: EventRow): string {
  const eventUrl = `${APP_URL}/community/calendar/${event.id}`;
  const formattedDate = formatEventDate(event.startTime);
  const formattedTime = formatEventTime(event.startTime, event.isAllDay ?? false);

  const descriptionText = event.description
    ? stripHtml(event.description).slice(0, 300)
    : "";

  const eventTypeLabel = event.eventType
    ? event.eventType.charAt(0).toUpperCase() + event.eventType.slice(1)
    : "Community Event";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:#1e3a5f;padding:24px 32px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:bold;">FrumToronto</h1>
              <p style="color:#a8c4d8;margin:6px 0 0;font-size:14px;">Community Event</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 8px;color:#1e3a5f;font-size:20px;">${event.title}</h2>
              <p style="margin:0 0 20px;display:inline-block;background:#dbeafe;color:#1e3a5f;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;">${eventTypeLabel}</p>

              <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;">
                <tr>
                  <td style="padding:6px 0;color:#555;font-size:14px;width:110px;vertical-align:top;font-weight:600;">Date</td>
                  <td style="padding:6px 0;color:#222;font-size:14px;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#555;font-size:14px;width:110px;vertical-align:top;font-weight:600;">Time</td>
                  <td style="padding:6px 0;color:#222;font-size:14px;">${formattedTime}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#555;font-size:14px;width:110px;vertical-align:top;font-weight:600;">Location</td>
                  <td style="padding:6px 0;color:#222;font-size:14px;">${event.location || "TBD"}</td>
                </tr>
                ${event.cost ? `<tr><td style="padding:6px 0;color:#555;font-size:14px;width:110px;vertical-align:top;font-weight:600;">Cost</td><td style="padding:6px 0;color:#222;font-size:14px;">${event.cost}</td></tr>` : ""}
                ${event.organization ? `<tr><td style="padding:6px 0;color:#555;font-size:14px;width:110px;vertical-align:top;font-weight:600;">Organization</td><td style="padding:6px 0;color:#222;font-size:14px;">${event.organization}</td></tr>` : ""}
              </table>

              ${descriptionText ? `<p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 24px;">${descriptionText}${event.description && stripHtml(event.description).length > 300 ? "..." : ""}</p>` : ""}

              <!-- Primary CTA -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
                <tr>
                  <td style="background:#1e3a5f;border-radius:6px;">
                    <a href="${eventUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">View Event Details</a>
                  </td>
                </tr>
              </table>

              <!-- Secondary links -->
              ${event.flyerUrl ? `<p style="margin:8px 0;font-size:14px;"><a href="${event.flyerUrl}" style="color:#1e3a5f;">Download Flyer</a></p>` : ""}
              ${event.websiteUrl ? `<p style="margin:8px 0;font-size:14px;"><a href="${event.websiteUrl}" style="color:#1e3a5f;">Event Website</a></p>` : ""}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
              <p style="color:#6b7280;font-size:12px;margin:0 0 8px;">You're receiving this because you subscribed to community event notifications.</p>
              <p style="color:#6b7280;font-size:12px;margin:0;">
                <a href="${APP_URL}/dashboard/settings" style="color:#1e3a5f;">Manage preferences</a>
                &nbsp;|&nbsp;
                <a href="${APP_URL}/newsletter/unsubscribe" style="color:#1e3a5f;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function buildEventConflictNotificationHtml(newEvent: EventRow, conflictingEventId?: number): string {
  const newEventUrl = `${APP_URL}/community/calendar/${newEvent.id}`;
  const formattedDate = formatEventDate(newEvent.startTime);
  const formattedTime = formatEventTime(newEvent.startTime, newEvent.isAllDay ?? false);

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:#1e3a5f;padding:24px 32px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:bold;">FrumToronto</h1>
              <p style="color:#a8c4d8;margin:6px 0 0;font-size:14px;">Event Scheduling Notice</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="color:#222;font-size:15px;margin:0 0 16px;">Hi,</p>
              <p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 24px;">
                A new event has been added to the FrumToronto community calendar on the same day as your event.
              </p>

              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:0 0 24px;">
                <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:0.5px;">New Event</p>
                <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#1e3a5f;">${newEvent.title}</p>
                <table cellpadding="0" cellspacing="0" style="width:100%;">
                  <tr>
                    <td style="padding:4px 0;color:#555;font-size:13px;width:110px;font-weight:600;">Organization</td>
                    <td style="padding:4px 0;color:#222;font-size:13px;">${newEvent.organization || "—"}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;color:#555;font-size:13px;width:110px;font-weight:600;">Date</td>
                    <td style="padding:4px 0;color:#222;font-size:13px;">${formattedDate}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;color:#555;font-size:13px;width:110px;font-weight:600;">Time</td>
                    <td style="padding:4px 0;color:#222;font-size:13px;">${formattedTime}</td>
                  </tr>
                </table>
              </div>

              <p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 24px;">
                You may want to reach out to coordinate. If you have any concerns, please contact us.
              </p>

              <table cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
                <tr>
                  <td style="background:#1e3a5f;border-radius:6px;">
                    <a href="${newEventUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">View the New Event</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
              <p style="color:#6b7280;font-size:12px;margin:0;">
                This notice was sent because another organizer scheduled an event on the same day as yours.
                ${conflictingEventId ? `You can manage your event at <a href="${APP_URL}/community/calendar/${conflictingEventId}" style="color:#1e3a5f;">frumtoronto.com</a>.` : ""}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Send event live broadcast to all communityEvents subscribers.
 * Called when an event's approvalStatus transitions to "approved".
 * Errors are caught by the caller — this function throws on failure.
 */
export async function sendEventLiveEmail(event: EventRow): Promise<void> {
  if (!resend) {
    console.warn("[EVENTS] Resend not initialized — skipping event live email");
    return;
  }

  const subscribers = await db
    .select({ email: emailSubscribers.email })
    .from(emailSubscribers)
    .where(
      and(
        eq(emailSubscribers.communityEvents, true),
        eq(emailSubscribers.isActive, true),
        isNotNull(emailSubscribers.userId),
        sql`${emailSubscribers.unsubscribedAt} IS NULL`
      )
    );

  if (subscribers.length === 0) {
    console.log("[EVENTS] No communityEvents subscribers — skipping broadcast");
    return;
  }

  const html = buildEventLiveEmailHtml(event);
  const subject = `New Event: ${event.title} — ${formatEventDate(event.startTime)}`;

  const batches = chunkArray(subscribers, 100);
  for (const batch of batches) {
    await resend.batch.send(
      batch.map((s) => ({
        from: EMAIL_FROM,
        to: s.email,
        subject,
        html,
      }))
    );
  }

  console.log(`[EVENTS] Sent event live email for "${event.title}" to ${subscribers.length} subscribers`);
}

/**
 * Send a conflict notification email to an existing event organizer.
 * Called when a new approved event is force-scheduled on the same day.
 * Errors are caught by the caller — this function throws on failure.
 */
export async function sendEventConflictNotificationEmail(
  newEvent: EventRow,
  recipientEmail: string
): Promise<void> {
  if (!resend) {
    console.warn("[EVENTS] Resend not initialized — skipping conflict notification email");
    return;
  }

  const formattedDate = formatEventDate(newEvent.startTime);
  const html = buildEventConflictNotificationHtml(newEvent);

  await resend.emails.send({
    from: EMAIL_FROM,
    to: recipientEmail,
    subject: `Heads up: Another event is scheduled on ${formattedDate}`,
    html,
  });

  console.log(`[EVENTS] Sent conflict notification to ${recipientEmail} for event "${newEvent.title}"`);
}
