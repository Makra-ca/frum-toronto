import { describe, it, expect, afterEach } from "vitest";
import { isAuthorisedCronRequest } from "@/lib/auth/cron-auth";

/**
 * All four cron endpoints were reachable anonymously. CRON_SECRET existed
 * neither in .env nor in Vercel, and two different broken guards resulted:
 * two skipped the check entirely when the secret was falsy, and two required
 * the literal header "Bearer undefined".
 *
 * Verified against production before the fix:
 *   GET /api/cron/cleanup-notifications -H "Bearer undefined"  -> 200
 *   GET /api/cron/newsletter-send       (no header at all)     -> 200
 */

const ORIGINAL = process.env.CRON_SECRET;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL;
});

const req = (auth?: string) =>
  new Request("http://localhost/api/cron/whatever", {
    headers: auth ? { authorization: auth } : {},
  });

describe("isAuthorisedCronRequest", () => {
  it("rejects everything when no secret is configured", () => {
    delete process.env.CRON_SECRET;

    // The old fail-open guard let all of these through.
    expect(isAuthorisedCronRequest(req())).toBe(false);
    expect(isAuthorisedCronRequest(req("Bearer undefined"))).toBe(false);
    expect(isAuthorisedCronRequest(req("Bearer anything"))).toBe(false);
  });

  it("accepts the configured secret", () => {
    process.env.CRON_SECRET = "s3cr3t-value";
    expect(isAuthorisedCronRequest(req("Bearer s3cr3t-value"))).toBe(true);
  });

  it("rejects a wrong secret, a missing header and a missing scheme", () => {
    process.env.CRON_SECRET = "s3cr3t-value";
    expect(isAuthorisedCronRequest(req("Bearer wrong"))).toBe(false);
    expect(isAuthorisedCronRequest(req())).toBe(false);
    expect(isAuthorisedCronRequest(req("s3cr3t-value"))).toBe(false);
  });

  it("rejects the literal string the old guard demanded", () => {
    // Two routes compared against `Bearer ${undefined}`, so this exact header
    // authenticated anyone. It must never work again, secret set or not.
    process.env.CRON_SECRET = "s3cr3t-value";
    expect(isAuthorisedCronRequest(req("Bearer undefined"))).toBe(false);
  });

  it("does not authorise on a prefix or a longer header", () => {
    process.env.CRON_SECRET = "s3cr3t-value";
    expect(isAuthorisedCronRequest(req("Bearer s3cr3t"))).toBe(false);
    expect(isAuthorisedCronRequest(req("Bearer s3cr3t-value-extra"))).toBe(false);
  });
});
