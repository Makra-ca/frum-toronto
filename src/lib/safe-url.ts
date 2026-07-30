/**
 * Normalising user-supplied URLs before they reach an `href`.
 *
 * ## Why this exists
 *
 * Two separate problems kept being solved separately, and each solution created
 * the other's bug.
 *
 * **1. People leave the scheme off.** Someone types "torahmasters.org" into a
 * website field. Rendered as-is that is a *relative* href, so it resolves to
 * frumtoronto.com/torahmasters.org and 404s. The repo's long-standing fix is
 * `url.startsWith("http") ? url : "https://" + url`, repeated in eight files.
 *
 * **2. Some schemes are dangerous.** `javascript:alert(1)` in an href is stored
 * XSS. `zod`'s `.url()` does NOT catch this — it is `new URL()` underneath, which
 * accepts `javascript:` and `data:` as syntactically valid URLs while *rejecting*
 * the scheme-less "torahmasters.org" that we do want to accept. It validates
 * syntax, not intent, and on this kind of field it is precisely backwards.
 *
 * The `startsWith("http")` idiom happens to defuse `javascript:` — the URL fails
 * the test, gets prefixed into `https://javascript:alert(1)` and dies harmlessly.
 * That is protection by accident, and it is fragile in both directions: someone
 * tidying up link handling can remove it without realising it was load-bearing,
 * and it already admits `httpevil:x`, which does start with "http".
 *
 * ## What this does instead
 *
 * Parses, then checks the protocol against an allowlist. **Fails closed** — an
 * untrusted scheme returns null rather than being "repaired". Repairing guesses
 * at intent; a scheme you do not recognise is not a typo, it is input to reject.
 */

/** The only protocols permitted to reach an href. */
const SAFE_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * A leading scheme, e.g. "https:", "javascript:", "mailto:".
 *
 * Note the charset excludes `.`, even though RFC 3986 permits it in a scheme.
 * With dots allowed, "example.com:8080/x" matches as scheme "example.com:" and
 * gets rejected, when the user plainly meant a host and a port.
 *
 * Excluding dots is also strictly *safer*, not a trade-off: every scheme worth
 * blocking (javascript, data, vbscript, file) is dotless, so it still matches
 * and is still rejected. A dotted input like "javascript.evil:alert(1)" instead
 * falls through to the https:// prefix, where it becomes an invalid port and
 * fails to parse — rejected by a different route, but rejected.
 */
const HAS_SCHEME = /^[a-z][a-z0-9+-]*:/i;

/**
 * Returns a safe absolute URL, or null if the input cannot be trusted or used.
 *
 * - `"torahmasters.org"`        → `"https://torahmasters.org/"`  (scheme added)
 * - `"https://a.com/x"`         → `"https://a.com/x"`
 * - `"javascript:alert(1)"`     → `null`
 * - `"httpevil:payload"`        → `null`
 * - `""` / whitespace / null    → `null`
 */
export function normalizeExternalUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  const candidate = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (!SAFE_PROTOCOLS.has(parsed.protocol)) return null;

  // No hostname check is needed after the protocol allowlist: for http/https a
  // missing host makes `new URL()` throw ("https://" and "http://?q=1" both do),
  // so anything reaching here already has one. Verified, not assumed — note that
  // "https:///nowhere" is NOT hostless, it parses as host "nowhere".
  return parsed.toString();
}

/**
 * True when a URL is safe to put in an href.
 *
 * For form validation, where the goal is to reject the submission with a message
 * rather than silently drop the field. Silently nulling what someone typed is a
 * decision made on their behalf without telling them.
 */
export function isSafeExternalUrl(raw: string | null | undefined): boolean {
  return normalizeExternalUrl(raw) !== null;
}
