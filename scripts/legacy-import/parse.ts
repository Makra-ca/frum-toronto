/**
 * Pure parsing/classification logic for the legacy import.
 *
 * Kept separate from the runner scripts on purpose: those call main() at module
 * scope, so a test importing them would connect to both databases as a side
 * effect of `import`. Everything here is a pure function over strings, mirroring
 * how src/lib/hero/*.ts holds pure logic apart from the components that use it.
 */

// ============================================
// SIMCHA TYPE CLASSIFICATION
// ============================================

/**
 * Classifies a pre-2010 simcha announcement (legacy category 29, which predates
 * the split into typed categories and is therefore mixed).
 *
 * Order matters: "bat mitzvah" is tested before "bar mitzvah" so neither
 * shadows the other, and engagement before wedding because engagement notices
 * routinely mention the upcoming marriage.
 */
export function classifyMixedSimcha(title: string, body: string): string {
  const t = `${title}\n${body}`.toLowerCase();
  const has = (...needles: string[]) => needles.some((n) => t.includes(n));

  if (has("bat mitzvah", "bas mitzvah", "bat mitzva", "bas mitzva")) return "bat-mitzvah";
  if (has("bar mitzvah", "bar mitzva")) return "bar-mitzvah";
  if (has("engagement", "engaged", "kallah", "chosson and kallah")) return "engagement";
  if (has("birth of", "birth in", "on the birth", "new baby", "baby boy", "baby girl"))
    return "birth";
  if (has("wedding", "marriage", "aufruf", "chasunah", "chasuna", "nuptials", "married"))
    return "wedding";
  if (has("anniversary")) return "anniversary";
  return "other";
}

// ============================================
// SHIVA NIFTAR NAME EXTRACTION
// ============================================

/**
 * Leading phrases observed across all 3,553 legacy shiva titles, longest first
 * so a longer phrase is never shadowed by a shorter one it contains
 * ("Bereavement & Shiva Information for" vs "Bereavement").
 */
const TITLE_PREFIXES = [
  "funeral and shiva notification -",
  "funeral and shiva notification",
  "funeral and shiva notice for",
  "funeral and shiva notice -",
  "funeral and shiva information for",
  "funeral & shiva notification -",
  "funeral & shiva notice for",
  "funeral & shiva",
  "funeral and shiva",
  "funeral announcement -",
  "funeral announcement",
  "bereavement & shiva information for",
  "bereavement & shiva notice for",
  "bereavement & shiva",
  "bereavement and shiva information for",
  "bereavement and shiva",
  "bereavement information for",
  "bereavement notification -",
  "bereavement notification",
  "bereavement notice for",
  "bereavement notice -",
  "bereavement notice",
  "bereavement-",
  "bereavement -",
  "bereavement",
  "updated: shiva notification -",
  "updated: shiva notification",
  "updated: shiva notice",
  "updated:",
  "shiva notification -",
  "shiva notification for",
  "shiva notification",
  "shiva notice for",
  "shiva notice -",
  "shiva notice",
  "shiva information for",
  "shiva info on passing of",
  "shiva info for",
  "shiva info -",
  "shiva information",
  "shiva for",
  "levaya and shiva notification -",
  "levaya and shiva information for",
  "levaya and shiva",
  "levaya of",
  "baruch dayan haemes-",
  "baruch dayan haemes -",
  "baruch dayan haemes",
  "baruch dayan haemet-",
  "baruch dayan haemet",
  "boruch dayan haemes-",
  "boruch dayan haemes",
  "boruch dayan emes",
  "baruch dayan emes",
  "p'tirah of",
  "p’tirah of",
  "p'tira of",
  "p’tira of",
  "ptirah of",
  "petirah of",
  "ptira of",
  "petira of",
  "funeral notice for",
  "funeral notice -",
  "funeral notice",
  "funeral information for",
  "funeral info for",
  "levaya notification -",
  "levaya notice -",
  "levaya notice",
  "shiva -",
  "our condolences on the passing of",
  "our condolences on the petira of",
  "our condolences to",
  "condolences on the passing of",
  "condolences to",
  "in memory of",
  "the passing of",
  "passing of",
  "updated - funeral and shiva notification -",
  "updated - shiva notification -",
  "updated - shiva notice -",
  "updated -",
  "updated",
  "shiva and funeral notification -",
  "shiva and funeral notice for",
  "shiva and funeral for",
  "shiva and funeral",
  "shiva notivication -",
  "sincere condolences to",
  "funeral notification -",
  "funeral notification",
  "notification -",
  "notice -",
  "shiva of",
  "levaya for",
  "our member",
];

const HONORIFIC_ALTERNATIVES = [
  String.raw`z\s*t\s*z\s*["'’”“]{1,2}\s*l`,
  String.raw`z\s*t\s*["'’”“]{1,2}\s*l`,
  String.raw`z\s*["'’”“]{1,2}\s*l`,
  String.raw`a\s*["'’”“]{1,2}\s*h`,
  String.raw`o\s*["'’”“]{1,2}\s*h`,
  String.raw`hy\s*["'’”“]{0,2}\s*d`,
  String.raw`zatzal`,
  String.raw`ztl`,
  String.raw`zl`,
  String.raw`ah`,
  String.raw`oh`,
  String.raw`ז["'’”]?ל`,
  String.raw`ע["'’”]?ה`,
  String.raw`זצ["'’”]?ל`,
  String.raw`הי["'’”]?ד`,
].join("|");

/**
 * Matches an honorific anywhere, not only at the end.
 *
 * Anchoring on the honorific rather than a trailing position is what handles
 * titles where a relationship clause follows with no comma to split on, e.g.
 * `Mr. Shlomo Yitzchok Galet O”H Brother of Mr. Emil Galet` — the name ends
 * where the honorific begins. The trailing negative lookahead keeps "Ahuva"
 * and "Zlata" from being read as the honorifics "ah" and "zl".
 */
const HONORIFIC_ANYWHERE_RE = new RegExp(
  String.raw`[\s,._-]*(?:${HONORIFIC_ALTERNATIVES})(?![\p{L}])`,
  "iu"
);

/**
 * A transliterated Hebrew name, as legacy titles record it after a comma:
 * "Charles Paul Lapell, Yechiel Pinchas ben Chaim Zev". The patronymic particle
 * is what distinguishes this from an English relationship clause.
 */
const HEBREW_NAME_RE = /\b(ben|bas|bat|bar)\b|[\u0590-\u05FF]/i;

export interface ShivaName {
  /** Goes to niftar_name (NOT NULL). */
  name: string;
  /** Goes to niftar_name_hebrew when the title carried one. */
  hebrewName: string | null;
}

/**
 * Splits a legacy shiva title into the niftar's name and, when present, their
 * Hebrew name.
 *
 * Honorific titles like "Mr.", "Mrs." and "Rabbi" are kept — they are part of
 * how the community names people.
 */
export function parseShivaTitle(rawTitle: string): ShivaName {
  let s = rawTitle.trim();

  // Strip leading prefix phrases repeatedly: real titles stack them, e.g.
  // "Funeral Notice - Our Condolences on the Passing of Mr X".
  for (let pass = 0; pass < 4; pass++) {
    const lower = s.toLowerCase();
    const hit = TITLE_PREFIXES.find((p) => lower.startsWith(p));
    if (!hit) break;
    s = s.slice(hit.length).replace(/^[\s:,.\-–—]+/, "");
  }
  s = s.replace(/^[\s:,.\-–—]+/, "");

  // Truncate at the first honorific. This runs before the comma split because a
  // title can have both, e.g. "<english>, <hebrew> z\"l".
  const hon = s.match(HONORIFIC_ANYWHERE_RE);
  if (hon && hon.index !== undefined && hon.index > 0) {
    s = s.slice(0, hon.index);
  }

  // Whatever follows the first comma is either the Hebrew name or an English
  // relationship clause ("beloved mother of Sarah"). Only the former is kept;
  // the full text survives in notice_text either way.
  let hebrewName: string | null = null;
  const comma = s.indexOf(",");
  if (comma > 0) {
    const head = s.slice(0, comma).trim();
    const tail = s.slice(comma + 1).trim();
    if (head.split(/\s+/).length >= 2) {
      s = head;
      if (tail && HEBREW_NAME_RE.test(tail)) {
        hebrewName = tail.replace(/[\s,._\-–—]+$/, "").trim() || null;
      }
    }
  }

  return {
    name: s.replace(/[\s,._\-–—]+$/, "").trim(),
    hebrewName,
  };
}

/** Convenience wrapper for callers that only need the English name. */
export function extractNiftarName(rawTitle: string): string {
  return parseShivaTitle(rawTitle).name;
}

// ============================================
// KOSHER ALERT CLASSIFICATION
// ============================================

/** Certifying agencies as they appear in legacy kosher-alert text. */
const AGENCIES: [RegExp, string][] = [
  [/\bcor\b|kashruth council/i, "COR"],
  [/\bou\b|orthodox union/i, "OU"],
  [/\bstar-?k\b/i, "Star-K"],
  [/\bkof-?k\b/i, "Kof-K"],
  [/\bcrc\b|chicago rabbinical/i, "cRc"],
  [/\bmk\b|montreal kosher/i, "MK"],
  [/\bok\b|organized kashrus/i, "OK"],
  [/\bbadatz\b/i, "Badatz"],
];

export function detectCertifyingAgency(text: string): string | null {
  for (const [re, name] of AGENCIES) {
    if (re.test(text)) return name;
  }
  return null;
}

/**
 * Maps a legacy kosher alert to one of the four alert types the current admin UI
 * offers (recall, status_change, warning, update). Recall is tested first because
 * a recall notice is the most consequential reading of an ambiguous body.
 */
export function classifyKosherAlert(title: string, body: string): string {
  const t = `${title}\n${body}`.toLowerCase();
  const has = (...needles: string[]) => needles.some((n) => t.includes(n));

  if (has("recall", "recalled", "do not consume", "do not use", "remove from")) return "recall";
  if (has("no longer certified", "no longer under", "lost certification", "not certified",
          "certification has been", "is now certified", "now under", "status change",
          "delisted", "decertified")) return "status_change";
  if (has("warning", "caution", "alert:", "mislabel", "mislabeled", "unauthorized",
          "counterfeit", "not kosher", "non-kosher")) return "warning";
  return "update";
}

// ============================================
// LEGACY HTML SANITIZATION (blog posts)
// ============================================

/**
 * Elements removed with their entire contents. `script` and `style` are the
 * obvious ones; the rest are removed because nothing in a 20-year-old community
 * blog post needs them and each is an injection or clickjacking vector.
 */
const DROP_ELEMENTS = [
  "script", "style", "iframe", "frame", "frameset", "object", "embed",
  "applet", "form", "input", "button", "select", "textarea", "link",
  "meta", "base", "svg", "math", "template", "noscript",
];

/** Hosts that served the legacy images. Both now return 404. */
const DEAD_IMAGE_HOSTS = [/frumtoronto\.com/i, /216\.105\.90\.65/];

export interface SanitizedHtml {
  html: string;
  /** Images dropped because their host is dead — reported, never silently lost. */
  removedImages: number;
}

/**
 * Conservative sanitizer for legacy blog HTML.
 *
 * Required because `src/app/(public)/blog/[slug]/page.tsx` renders
 * `post.content` through dangerouslySetInnerHTML. Native posts come from TipTap
 * and are trusted; these come from a two-decade-old database that no one has
 * audited, so passing them straight through would be a genuine XSS hole. The
 * repo has no sanitizer dependency, hence this one.
 *
 * This is a denylist, which is weaker than an allowlist in general. It is
 * acceptable here because the input is a fixed, finite corpus imported once by
 * an operator — not user input arriving at runtime.
 */
export function sanitizeLegacyHtml(input: string | null | undefined): SanitizedHtml {
  if (!input) return { html: "", removedImages: 0 };

  let s = String(input);

  // Whole elements, including contents.
  for (const tag of DROP_ELEMENTS) {
    s = s.replace(
      new RegExp(String.raw`<\s*${tag}\b[^>]*>[\s\S]*?<\s*\/\s*${tag}\s*>`, "gi"),
      ""
    );
    // Unclosed or self-closing form of the same tag.
    s = s.replace(new RegExp(String.raw`<\s*\/?\s*${tag}\b[^>]*>`, "gi"), "");
  }

  // Images whose host is dead would render as broken pictures.
  let removedImages = 0;
  s = s.replace(/<\s*img\b[^>]*>/gi, (tag) => {
    const src = tag.match(/\bsrc\s*=\s*["']?([^"'\s>]+)/i)?.[1] ?? "";
    if (!src || DEAD_IMAGE_HOSTS.some((h) => h.test(src)) || /^\.{0,2}\//.test(src)) {
      removedImages++;
      return "";
    }
    return tag;
  });

  // Inline event handlers, quoted and unquoted.
  s = s.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");
  s = s.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
  s = s.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");

  // Scheme-based script execution in href/src/action.
  s = s.replace(
    /\s(href|src|action|formaction)\s*=\s*(["']?)\s*(?:javascript|vbscript|data)\s*:[^"'>\s]*\2/gi,
    ""
  );

  // style attributes can carry url(javascript:...) and expression() payloads.
  s = s.replace(/\sstyle\s*=\s*"[^"]*(?:expression|javascript|behaviour|behavior)[^"]*"/gi, "");
  s = s.replace(/\sstyle\s*=\s*'[^']*(?:expression|javascript|behaviour|behavior)[^']*'/gi, "");

  return { html: s.trim(), removedImages };
}

/** URL-safe slug, matching the getUniqueSlug convention used across this repo. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
