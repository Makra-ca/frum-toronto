import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  signClickDestination,
  isValidClickSignature,
} from "@/lib/newsletter/click-signature";

/**
 * /api/newsletter/track/click redirected to any URL `new URL()` could parse.
 *
 * That made frumtoronto.com a laundering host: a phishing link whose visible
 * host, hover preview and corporate link-scanner result are all ours, aimed at
 * a mailing list trained to click FrumToronto links.
 *
 * Verified live before the fix: ?url=https://example.com/ returned a 307 to
 * example.com.
 */

const ORIGINAL = process.env.NEXTAUTH_SECRET;

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = "test-secret-for-click-signing";
});

afterAll(() => {
  if (ORIGINAL === undefined) delete process.env.NEXTAUTH_SECRET;
  else process.env.NEXTAUTH_SECRET = ORIGINAL;
});

describe("newsletter click signatures", () => {
  it("accepts a destination we signed", () => {
    const url = "https://example.com/kosher-list";
    expect(isValidClickSignature(url, signClickDestination(url))).toBe(true);
  });

  it("rejects an unsigned link — the exploit shape", () => {
    // What an attacker can construct without the secret: a tracking URL with
    // any destination and no signature at all.
    expect(isValidClickSignature("https://evil.example/login", null)).toBe(false);
    expect(isValidClickSignature("https://evil.example/login", "")).toBe(false);
  });

  it("rejects a signature lifted from a different destination", () => {
    // Every recipient holds a valid signature for the newsletter's own links.
    // Reusing one on a different destination must not work.
    const legitimate = "https://frumtoronto.com/blog/post";
    const stolen = signClickDestination(legitimate);
    expect(isValidClickSignature("https://evil.example/login", stolen)).toBe(false);
  });

  it("rejects a tampered destination, down to one character", () => {
    const url = "https://frumtoronto.com/shuls";
    const sig = signClickDestination(url);
    expect(isValidClickSignature("https://frumtoronto.com/shul", sig)).toBe(false);
    expect(isValidClickSignature("https://frumtoronto.com/shuls?", sig)).toBe(false);
    expect(isValidClickSignature("https://frumtoronto.com/shuIs", sig)).toBe(false);
  });

  it("rejects a truncated or padded signature without throwing", () => {
    // timingSafeEqual throws on a length mismatch, and the attacker chooses the
    // length — so the length check has to come first or this is a 500, not a
    // rejection.
    const url = "https://frumtoronto.com/";
    const sig = signClickDestination(url);
    expect(isValidClickSignature(url, sig.slice(0, 8))).toBe(false);
    expect(isValidClickSignature(url, sig + "00")).toBe(false);
  });

  it("rejects everything when no secret is configured", () => {
    delete process.env.NEXTAUTH_SECRET;
    try {
      const url = "https://frumtoronto.com/";
      // Cannot even mint one, so nothing can validate. Fails closed.
      expect(isValidClickSignature(url, "deadbeefdeadbeefdeadbeefdeadbeef")).toBe(false);
      expect(() => signClickDestination(url)).toThrow(/NEXTAUTH_SECRET/);
    } finally {
      process.env.NEXTAUTH_SECRET = "test-secret-for-click-signing";
    }
  });

  it("is a stable 32-character hex string", () => {
    const sig = signClickDestination("https://frumtoronto.com/");
    expect(sig).toMatch(/^[0-9a-f]{32}$/);
    expect(signClickDestination("https://frumtoronto.com/")).toBe(sig);
  });
});
