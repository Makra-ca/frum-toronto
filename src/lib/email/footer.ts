/**
 * Builds an HTML email footer with per-type unsubscribe and manage-all-preferences links.
 * Use this in all automated transactional emails.
 *
 * @param unsubscribeToken - The recipient's emailSubscribers.unsubscribeToken
 * @param preferenceType   - The preference column key (e.g. "askTheRabbiAnswered")
 * @param preferenceName   - Human-readable label (e.g. "Ask the Rabbi answer notifications")
 */
export function buildEmailFooter(params: {
  unsubscribeToken: string;
  preferenceType: string;
  preferenceName: string;
}): string {
  const { unsubscribeToken, preferenceType, preferenceName } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://frumtoronto.com";

  const unsubscribeUrl = `${baseUrl}/api/newsletter/unsubscribe-type?token=${encodeURIComponent(unsubscribeToken)}&type=${encodeURIComponent(preferenceType)}`;
  const preferencesUrl = `${baseUrl}/newsletter/preferences?token=${encodeURIComponent(unsubscribeToken)}`;

  return `
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 16px;" />
    <p style="margin: 0 0 8px; font-size: 12px; color: #6b7280; line-height: 1.5;">
      You received this email because you subscribed to ${preferenceName} on FrumToronto.
    </p>
    <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
      <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">
        Unsubscribe from ${preferenceName}
      </a>
      &nbsp;&nbsp;|&nbsp;&nbsp;
      <a href="${preferencesUrl}" style="color: #6b7280; text-decoration: underline;">
        Manage all email preferences
      </a>
    </p>
  `;
}
