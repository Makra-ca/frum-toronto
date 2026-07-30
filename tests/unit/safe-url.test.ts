import { describe, it, expect } from "vitest";
import { normalizeExternalUrl, isSafeExternalUrl, isUploadedImageUrl } from "@/lib/safe-url";

/**
 * These cases exist because `z.string().url()` — used on every URL field in this
 * repo — gets this exactly backwards: it ACCEPTS `javascript:alert(1)` and
 * REJECTS the scheme-less `torahmasters.org`. It is `new URL()` underneath, so it
 * validates syntax rather than intent.
 */
describe("normalizeExternalUrl", () => {
  describe("adds the scheme people leave off", () => {
    it.each([
      ["torahmasters.org", "https://torahmasters.org/"],
      ["torahmasters.org/semicha", "https://torahmasters.org/semicha"],
      ["www.example.com", "https://www.example.com/"],
      ["example.com:8080/x", "https://example.com:8080/x"],
    ])("%s -> %s", (input, expected) => {
      // Without this, the value is a RELATIVE href: it would resolve to
      // frumtoronto.com/torahmasters.org and 404.
      expect(normalizeExternalUrl(input)).toBe(expected);
    });
  });

  describe("leaves usable absolute URLs alone", () => {
    it.each([
      ["https://example.com/a?b=c#d", "https://example.com/a?b=c#d"],
      ["http://example.com/", "http://example.com/"],
      ["HTTPS://Example.COM/Path", "https://example.com/Path"], // host lowercased, path kept
    ])("%s -> %s", (input, expected) => {
      expect(normalizeExternalUrl(input)).toBe(expected);
    });
  });

  describe("refuses schemes that must never reach an href", () => {
    it.each([
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "  javascript:alert(1)  ",
      "java\tscript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "mailto:someone@example.com",
      "tel:+14165551234",
    ])("%s", (input) => {
      expect(normalizeExternalUrl(input)).toBeNull();
    });

    it("refuses a scheme that merely starts with http", () => {
      // The repo's `startsWith("http")` idiom lets this through, which is why
      // that idiom is not a security control.
      expect(normalizeExternalUrl("httpevil:payload")).toBeNull();
    });

    it("refuses a dotted scheme, which the scheme regex deliberately skips", () => {
      // HAS_SCHEME excludes dots so that "example.com:8080" reads as host:port.
      // The consequence must still be rejection, not acceptance: this gets the
      // https:// prefix, then fails to parse because "alert(1)" is not a port.
      expect(normalizeExternalUrl("javascript.evil:alert(1)")).toBeNull();
    });
  });

  describe("refuses unusable input", () => {
    it.each([null, undefined, "", "   ", "\n\t"])("%p", (input) => {
      expect(normalizeExternalUrl(input)).toBeNull();
    });

    it.each(["https://", "http://?q=1", "https://:8080/x"])(
      "unparseable: %s",
      (input) => {
        expect(normalizeExternalUrl(input)).toBeNull();
      }
    );
  });

  it("treats a triple slash as a host, not as hostless", () => {
    // Documents why there is no hostname check: this parses to host "nowhere",
    // and a genuinely hostless http(s) URL cannot parse at all.
    expect(normalizeExternalUrl("https:///nowhere")).toBe("https://nowhere/");
  });
});

/**
 * `imageUrl` is rendered with a raw <img src> — next/image is deliberately
 * bypassed for advertiser artwork — so `remotePatterns` does NOT constrain it.
 *
 * An image on infrastructure the advertiser controls defeats the whole review
 * workflow: the admin approves what the URL served at review time, and the
 * advertiser changes it afterwards. The row never changes, so the
 * "any edit resets to pending" rule never fires.
 */
describe("isUploadedImageUrl", () => {
  it.each([
    "https://abc123.public.blob.vercel-storage.com/homepage-ads/flyer.jpg",
    "https://xyz.public.blob.vercel-storage.com/a/b/c.png",
  ])("accepts our own upload host: %s", (url) => {
    expect(isUploadedImageUrl(url)).toBe(true);
  });

  it.each([
    ["a host the advertiser controls", "https://evil.example/flyer.jpg"],
    ["a lookalike suffix", "https://public.blob.vercel-storage.com.evil.example/x.jpg"],
    ["a lookalike prefix", "https://notpublic.blob.vercel-storage.com.evil.io/x.jpg"],
    ["an unsafe scheme", "javascript:alert(1)"],
    ["a data URL", "data:image/svg+xml,<svg onload=alert(1)>"],
    ["an empty value", ""],
    ["a bare hostname", "public.blob.vercel-storage.com.evil.example/x.jpg"],
  ])("rejects %s", (_label, url) => {
    expect(isUploadedImageUrl(url)).toBe(false);
  });

  it("rejects null and undefined", () => {
    expect(isUploadedImageUrl(null)).toBe(false);
    expect(isUploadedImageUrl(undefined)).toBe(false);
  });

  it("is not fooled by the host appearing in the path or query", () => {
    expect(
      isUploadedImageUrl("https://evil.example/public.blob.vercel-storage.com/x.jpg")
    ).toBe(false);
    expect(
      isUploadedImageUrl("https://evil.example/x.jpg?h=public.blob.vercel-storage.com")
    ).toBe(false);
  });
});

describe("isSafeExternalUrl", () => {
  it("accepts what normalizeExternalUrl can use", () => {
    expect(isSafeExternalUrl("torahmasters.org")).toBe(true);
    expect(isSafeExternalUrl("https://example.com")).toBe(true);
  });

  it("rejects what it cannot", () => {
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalUrl("")).toBe(false);
    expect(isSafeExternalUrl(null)).toBe(false);
  });
});
