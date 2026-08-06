/**
 * Cloudflare Turnstile verification for the registration form.
 *
 * ## Why
 *
 * Registration had no captcha, no honeypot and no rate limit — grepped for all
 * three, zero hits — and was taking 10–15 bot signups a day: keyboard-mash names
 * (`Sule Nqpowhiuo`, `Tafbu Tnbmkh`) on scraped business addresses. The user
 * table is now 3,200+ rows and the noise is drowning real members.
 *
 * Turnstile rather than reCAPTCHA: no visitor tracking, no puzzle for real
 * people to solve, and the free plan (20 widgets, unlimited verifications)
 * does not require the site's DNS to be on Cloudflare.
 *
 * ## Deliberately not rate-limited
 *
 * A per-IP cap was considered and declined for now. Turnstile alone is very
 * likely enough for this traffic — it is unsophisticated, not a determined
 * attacker farming tokens — and a rate-limit table on an unauthenticated
 * endpoint is a write surface an attacker controls. Revisit if signups keep
 * arriving after this ships.
 *
 * ## Missing-secret behaviour
 *
 * Fails CLOSED in production, OPEN elsewhere.
 *
 * A silent pass in production would mean the protection is off with nothing
 * saying so — the worst of both, since the page would show a widget implying it
 * works. A hard failure in development would block local work and every existing
 * test that posts to the register route, for no security benefit.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: "missing_token" | "invalid_token" | "not_configured" };

/**
 * Verifies a Turnstile token.
 *
 * `remoteIp` is optional and advisory — Cloudflare uses it to sharpen scoring.
 * It comes from a header the client can set, so it must never be treated as
 * trusted input.
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  remoteIp?: string | null
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[TURNSTILE] TURNSTILE_SECRET_KEY is not set — refusing registration");
      return { ok: false, reason: "not_configured" };
    }
    // Development and test: pass through so local work and the existing test
    // suite are not blocked by a key that only matters in production.
    return { ok: true };
  }

  if (!token) return { ok: false, reason: "missing_token" };

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (remoteIp) form.set("remoteip", remoteIp);

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });

    const data = (await response.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };

    if (data.success === true) return { ok: true };

    console.warn("[TURNSTILE] Verification failed:", data["error-codes"]);
    return { ok: false, reason: "invalid_token" };
  } catch (error) {
    // Cloudflare unreachable. Refuse rather than wave it through: a network
    // blip is not a reason to open the door, and registration is not so
    // time-critical that a retry is a hardship.
    console.error("[TURNSTILE] Verification request failed:", error);
    return { ok: false, reason: "invalid_token" };
  }
}

type FailureReason = Extract<TurnstileResult, { ok: false }>["reason"];

/**
 * The message a rejected visitor sees.
 *
 * `not_configured` is our fault, not theirs, so it does not tell them to retry
 * a check they cannot pass — there is no widget to complete when the key is
 * missing.
 */
export function turnstileErrorMessage(reason: FailureReason): string {
  return reason === "not_configured"
    ? "Sign-ups are temporarily unavailable. Please try again shortly."
    : "Please complete the verification check and try again.";
}
