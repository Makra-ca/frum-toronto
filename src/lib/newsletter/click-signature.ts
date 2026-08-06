import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signing the destination of a newsletter click-tracking link.
 *
 * ## Why
 *
 * `/api/newsletter/track/click?...&url=<anything>` took the destination from the
 * query string, checked only that `new URL()` could parse it, and redirected.
 * `new URL()` validates *syntax*, not *destination* — so the endpoint was an
 * open redirect: a link on frumtoronto.com that lands anywhere.
 *
 * That is worse here than the generic case. The audience is a mailing list
 * trained to click FrumToronto links, and the redirect survives every check a
 * cautious reader can actually perform: the visible host is ours, and so is the
 * host in a hover preview or a corporate link scanner.
 *
 * ## How
 *
 * The tracking URL is built server-side at send time (`newsletter-template.ts`),
 * so it can carry proof the destination came from us. An HMAC over the exact
 * destination string does that: only something holding `NEXTAUTH_SECRET` can
 * mint a link this endpoint will follow.
 *
 * An allowlist of hosts was the alternative and does not fit — newsletters link
 * legitimately to arbitrary business websites, so there is no list to write.
 *
 * ## Notes
 *
 * - Truncated to 32 hex characters (128 bits). This authenticates a public
 *   redirect target, not a credential; 128 bits is far past forgeable and keeps
 *   the emitted URL readable.
 * - `NEXTAUTH_SECRET` is reused deliberately rather than adding a fourth secret
 *   to configure. It is already required for the app to boot, so there is no
 *   state where signing silently degrades — see `clickSigningSecret`.
 * - No expiry. A newsletter link is expected to work indefinitely, and the
 *   signature binds the *destination*, which is the property that matters.
 */

function clickSigningSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  // Fail loudly rather than falling back. A default secret would mean anyone
  // reading this file could mint links, which is worse than no signature at all
  // because the endpoint would look protected.
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required to sign newsletter click links");
  }
  return secret;
}

/** The signature to attach to a tracking link for `destination`. */
export function signClickDestination(destination: string): string {
  return createHmac("sha256", clickSigningSecret())
    .update(destination)
    .digest("hex")
    .slice(0, 32);
}

/**
 * True when `signature` was minted by us for exactly this destination.
 *
 * Compared in constant time. The comparison is on the hex strings, and
 * `timingSafeEqual` throws on a length mismatch, so the length is checked first
 * — an attacker choosing the signature also chooses its length.
 */
export function isValidClickSignature(
  destination: string | null | undefined,
  signature: string | null | undefined
): boolean {
  if (!destination || !signature) return false;

  let expected: string;
  try {
    expected = signClickDestination(destination);
  } catch {
    // No secret configured: refuse every link rather than follow it.
    return false;
  }

  if (signature.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
