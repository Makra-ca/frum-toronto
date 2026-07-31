import { describe, it, expect } from "vitest";
import {
  getSubmissionOutcomeEmailHtml,
  REJECTION_FALLBACK,
} from "@/lib/email/templates";

describe("getSubmissionOutcomeEmailHtml", () => {
  const base = {
    typeLabel: "Event",
    itemTitle: "Lag BaOmer BBQ",
    actionUrl: "https://www.frumtoronto.com/dashboard/submissions",
  };

  // The copy is escaped on the way into the document, so its apostrophes
  // become &#x27; and the constant is never literally present. Match on a
  // fragment that survives escaping instead.
  const FALLBACK_FRAGMENT = "Reply to this email";

  it("writes the fallback when an admin rejects without a reason", () => {
    // The reason is optional, so blank is the path a busy admin will take.
    // "Not approved." on its own reads as a shrug.
    const html = getSubmissionOutcomeEmailHtml({ ...base, approved: false });
    expect(html).toContain(FALLBACK_FRAGMENT);
    expect(REJECTION_FALLBACK).toContain(FALLBACK_FRAGMENT);
  });

  it("uses the admin's reason when there is one", () => {
    const html = getSubmissionOutcomeEmailHtml({
      ...base,
      approved: false,
      reason: "The date clashes with an existing listing.",
    });
    expect(html).toContain("The date clashes with an existing listing.");
    expect(html).not.toContain(FALLBACK_FRAGMENT);
  });

  it("treats a whitespace-only reason as no reason", () => {
    const html = getSubmissionOutcomeEmailHtml({
      ...base,
      approved: false,
      reason: "   ",
    });
    expect(html).toContain(FALLBACK_FRAGMENT);
  });

  it("escapes submitted text", () => {
    // The title is user-supplied and lands inside an HTML document.
    const html = getSubmissionOutcomeEmailHtml({
      ...base,
      itemTitle: '<script>alert("x")</script>',
      approved: true,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("carries no unsubscribe link — these are transactional", () => {
    // CASL: consent is not required for these, identification still is.
    const html = getSubmissionOutcomeEmailHtml({ ...base, approved: true });
    expect(html.toLowerCase()).not.toContain("unsubscribe");
    expect(html).toContain("FrumToronto");
  });

  it("shows the current year, never a hardcoded one", () => {
    const html = getSubmissionOutcomeEmailHtml({ ...base, approved: true });
    expect(html).toContain(String(new Date().getFullYear()));
  });

  it("links somewhere different depending on the outcome", () => {
    const approved = getSubmissionOutcomeEmailHtml({
      ...base,
      approved: true,
      actionUrl: "https://www.frumtoronto.com/community/calendar/1",
      actionLabel: "View it on the site",
    });
    expect(approved).toContain("/community/calendar/1");
    expect(approved).toContain("View it on the site");
  });
});
