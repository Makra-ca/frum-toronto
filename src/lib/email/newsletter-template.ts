const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface NewsletterTemplateOptions {
  content: string;
  previewText?: string;
  sendId: number;
  subscriberId: number;
  unsubscribeToken: string;
  trackOpens?: boolean;
}

/**
 * Wraps all links in the content with tracking URLs
 */
function wrapLinksWithTracking(content: string, sendId: number, subscriberId: number): string {
  // Match href="..." or href='...' and wrap with tracking
  return content.replace(
    /href=["']([^"']+)["']/gi,
    (match, url) => {
      // Don't wrap mailto links, tel links, or internal anchor links
      if (
        url.startsWith("mailto:") ||
        url.startsWith("tel:") ||
        url.startsWith("#") ||
        url.includes("/newsletter/unsubscribe") ||
        url.includes("/newsletter/track")
      ) {
        return match;
      }
      const trackingUrl = `${APP_URL}/api/newsletter/track/click?sid=${sendId}&sub=${subscriberId}&url=${encodeURIComponent(url)}`;
      return `href="${trackingUrl}"`;
    }
  );
}

/**
 * Generates the full HTML email for a newsletter
 */
export function getNewsletterEmailHtml(options: NewsletterTemplateOptions): string {
  const {
    content,
    previewText,
    sendId,
    subscriberId,
    unsubscribeToken,
    trackOpens = true,
  } = options;

  const unsubscribeUrl = `${APP_URL}/newsletter/unsubscribe?token=${unsubscribeToken}`;
  const preferencesUrl = `${APP_URL}/newsletter/preferences?token=${unsubscribeToken}`;
  const trackingPixel = trackOpens
    ? `<img src="${APP_URL}/api/newsletter/track/open?sid=${sendId}&sub=${subscriberId}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`
    : "";

  // Wrap links with tracking
  const trackedContent = wrapLinksWithTracking(content, sendId, subscriberId);

  // Preview text is hidden text that shows in email clients
  const previewTextHtml = previewText
    ? `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</div>`
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>FrumToronto Newsletter</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset styles */
    body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }

    /* Mobile styles */
    @media screen and (max-width: 600px) {
      .container { width: 100% !important; max-width: 100% !important; }
      .content-padding { padding: 20px !important; }
      .mobile-center { text-align: center !important; }
      h1 { font-size: 24px !important; }
      h2 { font-size: 20px !important; }
      h3 { font-size: 18px !important; }
    }

    /* Content styles */
    .newsletter-content h1 { font-size: 28px; color: #1e3a8a; margin: 0 0 20px; }
    .newsletter-content h2 { font-size: 22px; color: #1e40af; margin: 30px 0 15px; }
    .newsletter-content h3 { font-size: 18px; color: #1e40af; margin: 25px 0 12px; }
    .newsletter-content p { margin: 0 0 16px; line-height: 1.6; color: #374151; }
    .newsletter-content a { color: #2563eb; text-decoration: underline; }
    .newsletter-content img { max-width: 100%; height: auto; margin: 16px 0; border-radius: 8px; }
    .newsletter-content ul, .newsletter-content ol { margin: 0 0 16px; padding-left: 24px; color: #374151; }
    .newsletter-content li { margin-bottom: 8px; line-height: 1.6; }
    .newsletter-content blockquote { border-left: 4px solid #2563eb; margin: 16px 0; padding: 12px 20px; background-color: #f0f4ff; color: #374151; }
    .newsletter-content hr { border: none; border-top: 1px solid #e5e7eb; margin: 30px 0; }

    /* Video embed styles */
    .newsletter-content iframe { max-width: 100%; border-radius: 8px; margin: 16px 0; }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  ${previewTextHtml}

  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" class="container" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px; text-align: center; background-color: #1e3a8a; border-radius: 8px 8px 0 0;">
              <a href="${APP_URL}" style="text-decoration: none;">
                <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; letter-spacing: -0.5px;">
                  Frum<span style="color: #60a5fa;">Toronto</span>
                </h1>
                <p style="margin: 8px 0 0; color: #93c5fd; font-size: 14px;">
                  Toronto's Jewish Orthodox Community Gateway
                </p>
              </a>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="content-padding newsletter-content" style="padding: 40px; font-size: 16px; line-height: 1.6; color: #374151;">
              ${trackedContent}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;">
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0 0 12px; color: #6b7280; font-size: 14px;">
                <a href="${APP_URL}" style="color: #2563eb; text-decoration: none;">Visit FrumToronto</a>
                &nbsp;&nbsp;|&nbsp;&nbsp;
                <a href="${preferencesUrl}" style="color: #2563eb; text-decoration: none;">Manage Preferences</a>
                &nbsp;&nbsp;|&nbsp;&nbsp;
                <a href="${unsubscribeUrl}" style="color: #2563eb; text-decoration: none;">Unsubscribe</a>
              </p>
              <p style="margin: 12px 0 0; color: #9ca3af; font-size: 12px;">
                &copy; ${new Date().getFullYear()} FrumToronto. The Toronto Jewish Orthodox Community Gateway.
              </p>
              <p style="margin: 8px 0 0; color: #9ca3af; font-size: 11px;">
                You're receiving this because you subscribed to FrumToronto newsletters.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

  ${trackingPixel}
</body>
</html>
  `.trim();
}

/**
 * Simple text version of the newsletter for email clients that don't support HTML
 */
export function getNewsletterPlainText(
  content: string,
  unsubscribeToken: string
): string {
  const unsubscribeUrl = `${APP_URL}/newsletter/unsubscribe?token=${unsubscribeToken}`;

  // Strip HTML tags for plain text version
  const plainContent = content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return `
FrumToronto Newsletter
======================

${plainContent}

---

Visit us: ${APP_URL}
Unsubscribe: ${unsubscribeUrl}

© ${new Date().getFullYear()} FrumToronto. The Toronto Jewish Orthodox Community Gateway.
  `.trim();
}
