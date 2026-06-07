import { db } from "@/lib/db";
import { notifications, users, formEmailRecipients } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { resend, EMAIL_FROM } from "@/lib/email/resend";
import { getAdminNotificationEmailHtml } from "@/lib/email/templates";

interface NotificationPayload {
  userId: number;
  type: string;
  title: string;
  body?: string;
  linkUrl?: string;
}

/**
 * Creates a notification for a specific user.
 */
export async function createNotification(payload: NotificationPayload): Promise<void> {
  await db.insert(notifications).values({
    userId: payload.userId,
    type: payload.type,
    title: payload.title,
    body: payload.body ?? "",
    linkUrl: payload.linkUrl ?? null,
  });
}

/**
 * Creates a notification for ALL active admin users.
 */
export async function createAdminNotification(
  payload: Omit<NotificationPayload, "userId">
): Promise<void> {
  const adminUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true)));

  if (adminUsers.length === 0) return;

  await db.insert(notifications).values(
    adminUsers.map((admin) => ({
      userId: admin.id,
      type: payload.type,
      title: payload.title,
      body: payload.body ?? "",
      linkUrl: payload.linkUrl ?? null,
    }))
  );
}

// ============================================
// ADMIN SUBMISSION NOTIFICATIONS
// ============================================

export type SubmissionContentType =
  | "contact_form" | "shiva" | "kosher_alert" | "ask_the_rabbi"
  | "business" | "shul_request" | "non_profit" | "shoutout"          // Tier A
  | "event" | "simcha" | "classified" | "tehillim" | "blog_post"
  | "blog_comment" | "atr_comment" | "special" | "business_video"
  | "community_alert"                                                 // Tier B
  | "atr_quick_post" | "shul_edit" | "davening_edit" | "shul_document"; // Tier C-only

// Tier A types get an instant email when pending. Tehillim is Tier B but
// keeps its pre-existing instant email (decided with owner).
const INSTANT_EMAIL_TYPES = new Set<SubmissionContentType>([
  "contact_form",
  "shiva",
  "kosher_alert",
  "ask_the_rabbi",
  "business",
  "shul_request",
  "non_profit",
  "shoutout",
  "tehillim",
]);

// Maps contentType → formEmailRecipients.formType for email recipient lookup
const FORM_TYPE_BY_CONTENT: Partial<Record<SubmissionContentType, string>> = {
  contact_form: "contact_form",
  shiva: "shiva",
  kosher_alert: "kosher_alert",
  ask_the_rabbi: "ask_the_rabbi",
  business: "business_registration",
  shul_request: "shul_registration",
  non_profit: "non_profit",
  shoutout: "shoutout",
  tehillim: "tehillim",
};

interface SubmissionNotificationParams {
  contentType: SubmissionContentType;
  title: string;        // "New event submitted"
  body: string;         // "Lag BaOmer BBQ — by Daniel M."
  linkUrl: string;      // deep link, e.g. "/admin/approvals"
  status: "pending" | "auto_approved";
  /** Optional reply-to for instant emails (e.g. the submitter's address) */
  replyTo?: string;
}

/**
 * Single entry point for notifying admins about user submissions/mutations.
 *
 * - Always inserts in-app notifications for all active admins.
 * - Tier A types (+ tehillim) with status "pending" also get an instant email
 *   to the configured formEmailRecipients for that type.
 * - status "auto_approved" is always Tier C (in-app FYI only), regardless of
 *   contentType.
 * - Entirely non-fatal: every failure is caught and logged with [NOTIFY] —
 *   a notification failure must NEVER break the submission itself.
 */
export async function notifyAdminOfSubmission(
  params: SubmissionNotificationParams
): Promise<void> {
  try {
    const { contentType, title, body, linkUrl, status, replyTo } = params;

    // 1. In-app notification for all active admins (all tiers)
    try {
      await createAdminNotification({
        type: contentType,
        title,
        body,
        linkUrl,
      });
    } catch (error) {
      console.error("[NOTIFY] Failed to create in-app admin notifications:", error);
    }

    // 2. Instant email — Tier A (+ tehillim) pending submissions only.
    //    Auto-approved content never emails (Tier C by definition).
    if (status === "pending" && INSTANT_EMAIL_TYPES.has(contentType)) {
      try {
        const formType = FORM_TYPE_BY_CONTENT[contentType];
        if (formType && resend) {
          const recipients = await db
            .select({ email: formEmailRecipients.email })
            .from(formEmailRecipients)
            .where(
              and(
                eq(formEmailRecipients.formType, formType),
                eq(formEmailRecipients.isActive, true)
              )
            );

          if (recipients.length > 0) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            const absoluteLink = linkUrl.startsWith("http")
              ? linkUrl
              : `${appUrl}${linkUrl}`;

            const { error } = await resend.emails.send({
              from: EMAIL_FROM,
              to: recipients.map((r) => r.email),
              subject: title,
              html: getAdminNotificationEmailHtml({
                heading: title,
                body,
                linkUrl: absoluteLink,
              }),
              ...(replyTo ? { replyTo } : {}),
            });

            if (error) {
              console.error(`[NOTIFY] Failed to send admin email for ${contentType}:`, error);
            }
          }
        }
      } catch (error) {
        console.error(`[NOTIFY] Failed to send admin email for ${params.contentType}:`, error);
      }
    }

    // 3. Real-time push to admin clients.
    // TODO(Phase 2): trigger Pusher event "new-notification" on channel
    // "private-admin-notifications" with payload { title, linkUrl }.
  } catch (error) {
    // Absolute backstop — notification failures never propagate to the caller.
    console.error("[NOTIFY] notifyAdminOfSubmission failed:", error);
  }
}
