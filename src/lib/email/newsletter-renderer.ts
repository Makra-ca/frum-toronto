/**
 * Newsletter renderer — assembles the full email HTML from TipTap body + auto-content blocks.
 *
 * Design spec: docs/superpowers/specs/2026-05-25-newsletter-overhaul-design.md
 * Section 6 — Email Rendering Logic
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// ─────────────────────────────────────────────
// Data types for each block
// ─────────────────────────────────────────────

export interface OmerData {
  day: number;
  hebrewDay: string; // e.g. "Lag BaOmer"
  formula: string; // Full Hebrew/English formula
}

export interface BusinessShoutoutData {
  businessName: string;
  businessSlug: string;
  bannerImageUrl: string | null;
  tagline: string | null;
  contentHtml: string | null;
}

export interface AtrQuestion {
  id: number;
  questionNumber: number | null;
  title: string;
  question: string;
  answer: string | null;
  publishedAt: Date | string | null;
}

export interface EventData {
  id: number;
  title: string;
  startTime: Date | string;
  endTime: Date | string | null;
  location: string | null;
  description: string | null;
  eventType: string | null;
}

export interface SimchaData {
  id: number;
  familyName: string;
  announcement: string;
  eventDate: string | null;
  typeName: string;
  typeSlug: string;
}

export interface BlogPostData {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: Date | string | null;
}

export interface TehillimEntry {
  id: number;
  hebrewName: string | null;
  englishName: string | null;
  motherHebrewName: string | null;
}

export interface NewsletterRenderInput {
  newsletter: {
    title: string;
    subject: string;
    content: string; // TipTap HTML — may be empty
    previewText?: string | null;
  };
  blocks: {
    omer?: OmerData | null;
    shoutout?: BusinessShoutoutData | null;
    atr?: AtrQuestion[] | null;
    events?: EventData[] | null;
    simchas?: SimchaData[] | null;
    blog?: BlogPostData[] | null;
    tehillim?: TehillimEntry[] | null;
  };
  recipientEmail: string;
  unsubscribeToken: string;
  sendId?: number;
  subscriberId?: number;
  trackOpens?: boolean;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const SEPARATOR = `
  <tr>
    <td style="padding: 24px 0;">
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;" />
    </td>
  </tr>`;

function sectionHeader(label: string): string {
  return `<h2 style="font-family: Arial, sans-serif; font-size: 20px; font-weight: bold; color: #111827; margin: 0 0 12px 0; padding-bottom: 12px; border-bottom: 2px solid #3b82f6;">${label}</h2>`;
}

function formatDate(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Toronto",
  });
}

function formatDateTime(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  });
}

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text;
}

// ─────────────────────────────────────────────
// Block renderers
// ─────────────────────────────────────────────

function renderOmerBlock(data: OmerData): string {
  return `
  <tr>
    <td style="background-color: #fffbeb; padding: 24px; text-align: center;">
      <p style="font-size: 13px; color: #92400e; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px 0;">Sefirat HaOmer</p>
      <p style="font-size: 28px; font-weight: bold; color: #78350f; margin: 0 0 4px 0;">Day ${data.day} of the Omer</p>
      <p style="font-size: 16px; color: #92400e; margin: 0 0 12px 0;">${data.hebrewDay}</p>
      <p style="font-size: 14px; color: #b45309; font-style: italic; margin: 0;">${data.formula}</p>
    </td>
  </tr>`;
}

function renderShoutoutBlock(data: BusinessShoutoutData): string {
  const businessUrl = `${APP_URL}/directory/business/${data.businessSlug}`;
  const imageHtml = data.bannerImageUrl
    ? `<tr><td style="padding-bottom: 12px;"><img src="${data.bannerImageUrl}" alt="${data.businessName}" style="width: 100%; max-width: 520px; height: auto; display: block; border: 0;" /></td></tr>`
    : "";

  return `
  <tr>
    <td style="background-color: #eff6ff; padding: 24px; border-radius: 8px;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        ${imageHtml}
        <tr>
          <td>
            <p style="font-size: 13px; color: #1e40af; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 4px 0;">Featured Business</p>
            <h3 style="font-family: Arial, sans-serif; font-size: 22px; font-weight: bold; color: #111827; margin: 0 0 6px 0;">${data.businessName}</h3>
            ${data.tagline ? `<p style="font-size: 15px; color: #374151; margin: 0 0 12px 0;">${data.tagline}</p>` : ""}
            ${data.contentHtml ? `<div style="font-size: 15px; color: #374151; line-height: 1.6; margin-bottom: 16px;">${data.contentHtml}</div>` : ""}
            <a href="${businessUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 10px 20px; border-radius: 6px;">Visit Their Listing →</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function renderAtrBlock(questions: AtrQuestion[]): string {
  const items = questions
    .map((q) => {
      const answerExcerpt = truncate(q.answer, 200);
      const anchor = q.questionNumber ? `#q${q.questionNumber}` : "";
      const readMoreUrl = `${APP_URL}/ask-the-rabbi${anchor}`;
      return `
        <tr>
          <td style="padding-bottom: 16px;">
            <p style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 4px 0;">${q.title}</p>
            ${answerExcerpt ? `<p style="font-size: 15px; color: #374151; line-height: 1.6; margin: 0 0 6px 0;">${answerExcerpt}</p>` : ""}
            <a href="${readMoreUrl}" style="color: #2563eb; text-decoration: underline; font-size: 14px;">Read more →</a>
          </td>
        </tr>`;
    })
    .join("");

  return `
  <tr>
    <td style="padding: 24px 0;">
      ${sectionHeader("Ask the Rabbi")}
      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        ${items}
      </table>
    </td>
  </tr>`;
}

function renderEventsBlock(events: EventData[]): string {
  const items = events
    .map((e) => {
      const dateStr = formatDateTime(e.startTime);
      const detailUrl = `${APP_URL}/community/calendar/${e.id}`;
      const descExcerpt = truncate(e.description, 150);
      return `
        <tr>
          <td style="padding-bottom: 16px;">
            <p style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 2px 0;">${e.title}</p>
            <p style="font-size: 14px; color: #6b7280; margin: 0 0 4px 0;">${dateStr}${e.location ? ` · ${e.location}` : ""}</p>
            ${descExcerpt ? `<p style="font-size: 15px; color: #374151; line-height: 1.6; margin: 0 0 4px 0;">${descExcerpt}</p>` : ""}
            <a href="${detailUrl}" style="color: #2563eb; text-decoration: underline; font-size: 14px;">View event →</a>
          </td>
        </tr>`;
    })
    .join("");

  return `
  <tr>
    <td style="padding: 24px 0;">
      ${sectionHeader("Upcoming Events in Toronto")}
      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        ${items}
      </table>
    </td>
  </tr>`;
}

function renderSimchasBlock(simchas: SimchaData[]): string {
  // Group by simcha type
  const grouped: Record<string, SimchaData[]> = {};
  for (const s of simchas) {
    if (!grouped[s.typeName]) grouped[s.typeName] = [];
    grouped[s.typeName].push(s);
  }

  const groupOrder = ["Birth", "Engagement", "Wedding"];
  const sortedGroups = Object.keys(grouped).sort((a, b) => {
    const ai = groupOrder.indexOf(a);
    const bi = groupOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const groupHtml = sortedGroups
    .map((typeName) => {
      const entries = grouped[typeName]
        .map(
          (s) => `
          <tr>
            <td style="padding-bottom: 8px;">
              <p style="font-size: 15px; color: #374151; line-height: 1.6; margin: 0;">
                <strong>Mazel Tov — ${s.familyName}</strong>
                ${s.announcement ? `<br /><span style="color: #6b7280; font-size: 14px;">${truncate(s.announcement, 200)}</span>` : ""}
              </p>
            </td>
          </tr>`
        )
        .join("");

      return `
        <tr>
          <td style="padding-bottom: 16px;">
            <p style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 8px 0; border-bottom: 1px solid #f3f4f6; padding-bottom: 4px;">${typeName}s</p>
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              ${entries}
            </table>
          </td>
        </tr>`;
    })
    .join("");

  return `
  <tr>
    <td style="padding: 24px 0;">
      ${sectionHeader("Mazel Tov!")}
      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        ${groupHtml}
      </table>
    </td>
  </tr>`;
}

function renderBlogBlock(posts: BlogPostData[]): string {
  const items = posts
    .map((p) => {
      const postUrl = `${APP_URL}/blog/${p.slug}`;
      const excerptHtml = p.excerpt
        ? `<p style="font-size: 15px; color: #374151; line-height: 1.6; margin: 0 0 6px 0;">${truncate(p.excerpt, 150)}</p>`
        : "";
      const imageHtml =
        p.coverImageUrl
          ? `<tr><td style="padding-bottom: 8px;"><img src="${p.coverImageUrl}" alt="${p.title}" style="width: 100%; max-width: 520px; height: auto; display: block; border: 0;" /></td></tr>`
          : "";
      return `
        <tr>
          <td style="padding-bottom: 20px;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              ${imageHtml}
              <tr>
                <td>
                  <p style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 4px 0;">${p.title}</p>
                  ${excerptHtml}
                  <a href="${postUrl}" style="color: #2563eb; text-decoration: underline; font-size: 14px;">Read more →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    })
    .join("");

  return `
  <tr>
    <td style="padding: 24px 0;">
      ${sectionHeader("From the Blog")}
      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        ${items}
      </table>
    </td>
  </tr>`;
}

function renderTehillimBlock(
  entries: TehillimEntry[],
  totalCount: number
): string {
  const MAX_IN_EMAIL = 50;
  const shown = entries.slice(0, MAX_IN_EMAIL);

  const nameList = shown
    .map((e) => {
      const parts: string[] = [];
      if (e.hebrewName) parts.push(e.hebrewName);
      if (e.motherHebrewName) parts.push(`ben/bas ${e.motherHebrewName}`);
      if (parts.length === 0 && e.englishName) parts.push(e.englishName);
      return parts.join(" ");
    })
    .filter(Boolean)
    .join(", ");

  const overflowNote =
    totalCount > MAX_IN_EMAIL
      ? `<p style="font-size: 14px; color: #6b7280; margin-top: 12px;">And ${totalCount - MAX_IN_EMAIL} more — <a href="${APP_URL}/tehillim" style="color: #2563eb; text-decoration: underline;">view full list at frumtoronto.com/tehillim</a>.</p>`
      : "";

  return `
  <tr>
    <td style="padding: 24px 0;">
      ${sectionHeader("Tehillim — Please Daven For")}
      <p style="font-size: 15px; color: #374151; line-height: 1.8; margin: 16px 0 0 0;">${nameList}</p>
      ${overflowNote}
    </td>
  </tr>`;
}

// ─────────────────────────────────────────────
// Main render function
// ─────────────────────────────────────────────

export function renderNewsletterHTML(input: NewsletterRenderInput): string {
  const {
    newsletter,
    blocks,
    recipientEmail,
    unsubscribeToken,
    sendId,
    subscriberId,
    trackOpens = false,
  } = input;

  const unsubscribeNewsletterUrl = `${APP_URL}/newsletter/unsubscribe?token=${unsubscribeToken}&type=newsletter`;
  const unsubscribeAllUrl = `${APP_URL}/newsletter/unsubscribe?token=${unsubscribeToken}&type=all`;
  const preferencesUrl = `${APP_URL}/newsletter/preferences?token=${unsubscribeToken}`;

  const previewTextHtml =
    newsletter.previewText
      ? `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${newsletter.previewText}</div>`
      : "";

  const trackingPixelHtml =
    trackOpens && sendId && subscriberId
      ? `<img src="${APP_URL}/api/newsletter/track/open?sid=${sendId}&sub=${subscriberId}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`
      : "";

  // Build inner block rows in injection order (spec section 6)
  const blockRows: string[] = [];

  // 1. Omer (before main content)
  if (blocks.omer) {
    blockRows.push(renderOmerBlock(blocks.omer));
    blockRows.push(SEPARATOR);
  }

  // 2. Business Shoutout (before main content)
  if (blocks.shoutout) {
    blockRows.push(renderShoutoutBlock(blocks.shoutout));
    blockRows.push(SEPARATOR);
  }

  // 3. TipTap main content (always present — may be empty string)
  blockRows.push(`
  <tr>
    <td style="padding: 24px 0;" class="newsletter-content">
      ${newsletter.content || ""}
    </td>
  </tr>`);

  // 4. ATR
  if (blocks.atr && blocks.atr.length > 0) {
    blockRows.push(SEPARATOR);
    blockRows.push(renderAtrBlock(blocks.atr));
  }

  // 5. Events
  if (blocks.events && blocks.events.length > 0) {
    blockRows.push(SEPARATOR);
    blockRows.push(renderEventsBlock(blocks.events));
  }

  // 6. Simchas
  if (blocks.simchas && blocks.simchas.length > 0) {
    blockRows.push(SEPARATOR);
    blockRows.push(renderSimchasBlock(blocks.simchas));
  }

  // 7. Blog
  if (blocks.blog && blocks.blog.length > 0) {
    blockRows.push(SEPARATOR);
    blockRows.push(renderBlogBlock(blocks.blog));
  }

  // 8. Tehillim
  if (blocks.tehillim && blocks.tehillim.length > 0) {
    blockRows.push(SEPARATOR);
    blockRows.push(
      renderTehillimBlock(blocks.tehillim, blocks.tehillim.length)
    );
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${newsletter.subject}</title>
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
    body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
    @media screen and (max-width: 600px) {
      .container { width: 100% !important; max-width: 100% !important; }
      .content-padding { padding: 20px !important; }
    }
    .newsletter-content h1 { font-size: 28px; color: #1e3a8a; margin: 0 0 20px; }
    .newsletter-content h2 { font-size: 22px; color: #1e40af; margin: 30px 0 15px; }
    .newsletter-content h3 { font-size: 18px; color: #1e40af; margin: 25px 0 12px; }
    .newsletter-content p { margin: 0 0 16px; line-height: 1.6; color: #374151; }
    .newsletter-content a { color: #2563eb; text-decoration: underline; }
    .newsletter-content ul, .newsletter-content ol { margin: 0 0 16px; padding-left: 24px; color: #374151; }
    .newsletter-content li { margin-bottom: 8px; line-height: 1.6; }
    .newsletter-content blockquote { border-left: 4px solid #2563eb; margin: 16px 0; padding: 12px 20px; background-color: #f0f4ff; color: #374151; }
    .newsletter-content hr { border: none; border-top: 1px solid #e5e7eb; margin: 30px 0; }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f5;">
  ${previewTextHtml}

  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" class="container" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px; text-align: center; background-color: #1e3a8a; border-radius: 8px 8px 0 0;">
              <a href="${APP_URL}" style="text-decoration: none;">
                <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; letter-spacing: -0.5px; font-family: Arial, Helvetica, sans-serif;">
                  Frum<span style="color: #60a5fa;">Toronto</span>
                </h1>
                <p style="margin: 8px 0 0; color: #93c5fd; font-size: 14px; font-family: Arial, Helvetica, sans-serif;">
                  Toronto's Jewish Orthodox Community Gateway
                </p>
              </a>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="content-padding" style="padding: 32px 40px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                ${blockRows.join("\n")}
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px; font-family: Arial, Helvetica, sans-serif;">
                <a href="${unsubscribeNewsletterUrl}" style="color: #2563eb; text-decoration: underline;">Unsubscribe from this newsletter</a>
              </p>
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px; font-family: Arial, Helvetica, sans-serif;">
                <a href="${preferencesUrl}" style="color: #2563eb; text-decoration: underline;">Manage all notification preferences</a>
              </p>
              <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 14px; font-family: Arial, Helvetica, sans-serif;">
                <a href="${unsubscribeAllUrl}" style="color: #2563eb; text-decoration: underline;">Unsubscribe from all emails</a>
              </p>
              <p style="margin: 0 0 4px 0; color: #9ca3af; font-size: 12px; font-family: Arial, Helvetica, sans-serif;">
                &copy; ${new Date().getFullYear()} FrumToronto. The Toronto Jewish Orthodox Community Gateway.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 11px; font-family: Arial, Helvetica, sans-serif;">
                You're receiving this because you subscribed to FrumToronto newsletters.${recipientEmail ? ` (${recipientEmail})` : ""}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

  ${trackingPixelHtml}
</body>
</html>`;
}
