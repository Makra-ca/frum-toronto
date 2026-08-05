import { timingSafeEqual } from "node:crypto";

/**
 * Whether a cron request is authorised.
 *
 * **Fails closed.** If `CRON_SECRET` is unset, every request is rejected —
 * including Vercel's. That is deliberate: the alternative is what this replaces.
 *
 * Before 2026-08-05 the four cron routes carried two different broken guards,
 * and `CRON_SECRET` existed in neither `.env` nor Vercel:
 *
 *   // tehillim-cleanup, newsletter-send — FAIL OPEN
 *   if (cronSecret && authHeader !== `Bearer ${cronSecret}`) { ... }
 *   //  ^ undefined is falsy, so the check was skipped entirely
 *
 *   // cleanup-notifications, notification-digest — required a literal string
 *   if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) { ... }
 *   //  ^ the required header was exactly "Bearer undefined"
 *
 * Verified against production: `Bearer undefined` returned 200, and
 * newsletter-send returned 200 with no header at all. Anyone on the internet
 * could trigger the notification delete and drive newsletter batch sending.
 *
 * The same cause meant the two literal-string routes returned 401 to **Vercel's
 * own scheduler**, which only sends the header when CRON_SECRET is set — so the
 * daily digest had never run.
 *
 * Constant-time comparison because the header is attacker-supplied and the
 * secret is long-lived.
 */
export function isAuthorisedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;

  // No secret configured means nothing is authorised. Never skip the check.
  if (!secret) return false;

  const header = request.headers.get("authorization");
  if (!header) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);

  // timingSafeEqual throws on a length mismatch, which is itself a signal —
  // compare lengths first so both paths cost the same.
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
