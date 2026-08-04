import { db } from "@/lib/db";
import { notifications, users, formEmailRecipients } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { resend, EMAIL_FROM } from "@/lib/email/resend";
import { getAdminNotificationEmailHtml } from "@/lib/email/templates";
import { sendSubmissionOutcomeEmail } from "@/lib/email/send";
import {
  getPusherServer,
  ADMIN_NOTIFICATIONS_CHANNEL,
  NEW_NOTIFICATION_EVENT,
} from "@/lib/pusher";

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
 * Creates a notification for ALL active admin users — admins only, by design.
 *
 * Submission notifications no longer come through here: they go via
 * notifyAdminOfSubmission, which resolves admins ∪ capability holders and gives
 * each audience a link it can open. This remains for genuinely admin-only
 * signals, such as a trusted user editing live content.
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
  | "community_alert" | "homepage_ad"                                 // Tier B
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

/**
 * contentType → the capability whose holders are ALSO responsible for it.
 *
 * Only canManageAskTheRabbi grants review authority over other people's
 * content. The other capability columns are canAutoApprove* / canPostSpecials,
 * which govern a user's OWN submissions and so create no work queue and need no
 * incoming notification. That is why this map has three entries and not twenty.
 *
 * Shul-scoped types (shul_edit, davening_edit, shul_document, shul-linked
 * events) are deliberately absent: their right recipient is "whoever manages
 * THAT shul", which is a row lookup rather than a flag. Rejected for now — see
 * decisions/2026-08-03-notify-capability-holders-not-just-admins.
 */
export const CAPABILITY_BY_CONTENT = {
  ask_the_rabbi: "canManageAskTheRabbi",
  atr_comment: "canManageAskTheRabbi",
  atr_quick_post: "canManageAskTheRabbi",
} as const satisfies Partial<Record<SubmissionContentType, "canManageAskTheRabbi">>;

/**
 * Where a non-admin holder should be sent instead of the admin URL. Middleware
 * bounces a member from /admin, so without this the notification would be a
 * dead end for exactly the person it exists to reach.
 */
const NON_ADMIN_LINK_BY_CONTENT: Partial<Record<SubmissionContentType, string>> = {
  ask_the_rabbi: "/dashboard/ask-the-rabbi?tab=submissions",
  atr_comment: "/dashboard/ask-the-rabbi?tab=comments",
  atr_quick_post: "/dashboard/ask-the-rabbi?tab=questions",
};

export interface NotificationRecipient {
  id: number;
  email: string;
  isAdmin: boolean;
}

/**
 * Active admins ∪ active holders of the capability governing this content type,
 * deduplicated by user id (an admin who also holds the flag appears once).
 */
export async function resolveNotificationRecipients(
  contentType: SubmissionContentType
): Promise<NotificationRecipient[]> {
  const admins = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true)));

  const byId = new Map<number, NotificationRecipient>();
  for (const a of admins) byId.set(a.id, { ...a, isAdmin: true });

  const capability =
    CAPABILITY_BY_CONTENT[contentType as keyof typeof CAPABILITY_BY_CONTENT];

  if (capability) {
    const holders = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(and(eq(users[capability], true), eq(users.isActive, true)));

    // Admin wins on collision: they keep the admin link.
    for (const h of holders) {
      if (!byId.has(h.id)) byId.set(h.id, { ...h, isAdmin: false });
    }
  }

  return [...byId.values()];
}

/** The link this recipient can actually open. */
export function linkForRecipient(
  recipient: { isAdmin: boolean },
  adminLinkUrl: string,
  contentType: SubmissionContentType
): string {
  if (recipient.isAdmin) return adminLinkUrl;
  return NON_ADMIN_LINK_BY_CONTENT[contentType] ?? adminLinkUrl;
}

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

    // 1. In-app notification for everyone responsible: active admins, plus
    //    holders of the capability governing this type. Each gets the link
    //    their role can actually open.
    let recipients: NotificationRecipient[] = [];
    try {
      recipients = await resolveNotificationRecipients(contentType);

      if (recipients.length > 0) {
        await db.insert(notifications).values(
          recipients.map((r) => ({
            userId: r.id,
            type: contentType,
            title,
            body,
            linkUrl: linkForRecipient(r, linkUrl, contentType),
          }))
        );
      }
    } catch (error) {
      console.error("[NOTIFY] Failed to create in-app notifications:", error);
    }

    // 2. Instant email — Tier A (+ tehillim) pending submissions only.
    //    Auto-approved content never emails (Tier C by definition).
    if (status === "pending" && INSTANT_EMAIL_TYPES.has(contentType)) {
      try {
        const formType = FORM_TYPE_BY_CONTENT[contentType];
        if (formType && resend) {
          const configured = await db
            .select({ email: formEmailRecipients.email })
            .from(formEmailRecipients)
            .where(
              and(
                eq(formEmailRecipients.formType, formType),
                eq(formEmailRecipients.isActive, true)
              )
            );

          // Capability holders are responsible for this type, so they are
          // emailed alongside the configured recipients — otherwise the person
          // who has to act only finds out by visiting the page.
          const holderEmails = recipients.filter((r) => !r.isAdmin).map((r) => r.email);
          const to = [...new Set([...configured.map((r) => r.email), ...holderEmails])];

          if (to.length > 0) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            const absoluteLink = linkUrl.startsWith("http")
              ? linkUrl
              : `${appUrl}${linkUrl}`;

            const { error } = await resend.emails.send({
              from: EMAIL_FROM,
              to,
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

    // 3. Real-time push to admin clients (no sensitive payload — body is
    //    fetched from the DB when the bell opens). No-op without Pusher env vars.
    try {
      const pusher = getPusherServer();
      if (pusher) {
        await pusher.trigger(ADMIN_NOTIFICATIONS_CHANNEL, NEW_NOTIFICATION_EVENT, {
          title,
          linkUrl,
        });
      }
    } catch (error) {
      console.error("[NOTIFY] Failed to trigger Pusher event:", error);
    }
  } catch (error) {
    // Absolute backstop — notification failures never propagate to the caller.
    console.error("[NOTIFY] notifyAdminOfSubmission failed:", error);
  }
}

// ============================================
// SUBMITTER NOTIFICATIONS
// ============================================

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface SubmitterNotificationParams {
  userId: number;
  approved: boolean;
  /** Human label for the type, e.g. "Event". */
  typeLabel: string;
  itemTitle: string;
  /**
   * Already formatted by the caller. A `date` column must render through
   * formatDateOnly and a `timestamp` column through formatInstant; nothing
   * down here knows which the value came from, and guessing shifts every
   * date-only value back a day.
   */
  detail?: string | null;
  reason?: string | null;
  /** Where the live item lives, when there is a public page for it. */
  publicHref?: string | null;
}

/**
 * Tells a submitter what an admin decided about their submission.
 *
 * In-app record plus a transactional email. The user is told about the
 * ADMIN'S actions only — never about their own edit.
 *
 * Entirely non-fatal, like notifyAdminOfSubmission: a failed email must never
 * fail an approval. An admin pressing Approve and getting a 500 because Resend
 * was down would be a worse bug than a missed notification.
 */
export async function notifySubmitter(
  params: SubmitterNotificationParams
): Promise<void> {
  try {
    const { userId, approved, typeLabel, itemTitle, detail, reason, publicHref } =
      params;

    const dashboardHref = "/dashboard/submissions";
    const linkUrl = approved ? publicHref || dashboardHref : dashboardHref;

    try {
      await createNotification({
        userId,
        // These exact strings are switched on by dashboard/notifications;
        // anything else falls through to a plain grey bell.
        type: approved ? "content_approved" : "content_rejected",
        title: approved
          ? `Your ${typeLabel.toLowerCase()} is live`
          : `Your ${typeLabel.toLowerCase()} wasn't approved`,
        body: itemTitle,
        linkUrl,
      });
    } catch (error) {
      console.error("[NOTIFY] Failed to create submitter notification:", error);
    }

    try {
      const [user] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user?.email) {
        await sendSubmissionOutcomeEmail(user.email, {
          approved,
          typeLabel,
          itemTitle,
          detail,
          reason,
          actionUrl: linkUrl.startsWith("http") ? linkUrl : `${APP_URL}${linkUrl}`,
        });
      }
    } catch (error) {
      console.error("[NOTIFY] Failed to email the submitter:", error);
    }
  } catch (error) {
    console.error("[NOTIFY] notifySubmitter failed:", error);
  }
}

/**
 * Records that an auto-approver edited already-public content.
 *
 * The spec's sole mitigation for letting their edits stay live: someone with
 * canAutoApprove* could publish something innocuous and later edit it to
 * anything, unreviewed. In-app only, no email — a trail without inbox noise.
 */
export async function notifyAdminOfTrustedEdit(params: {
  typeLabel: string;
  itemTitle: string;
  editorName: string;
  linkUrl: string;
}): Promise<void> {
  try {
    await createAdminNotification({
      type: "trusted_user_posted",
      title: `${params.typeLabel} edited while live`,
      body: `${params.itemTitle} — edited by ${params.editorName}. It stayed on the site.`,
      linkUrl: params.linkUrl,
    });
  } catch (error) {
    console.error("[NOTIFY] Failed to record a trusted edit:", error);
  }
}
