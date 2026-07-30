import { describe, it, expect } from "vitest";
import {
  sanitizeLegacyHtml,
  slugify,
  classifyKosherAlert,
  detectCertifyingAgency,
  classifyMixedSimcha,
} from "../../scripts/legacy-import/parse";

/**
 * The blog detail page renders post.content via dangerouslySetInnerHTML, so
 * anything that survives this function is executed in the visitor's browser.
 */
describe("sanitizeLegacyHtml", () => {
  it("keeps ordinary formatting markup", () => {
    const input = '<div><b>Bold</b> and <i>italic</i> and <a href="https://cor.ca">a link</a></div>';
    const { html } = sanitizeLegacyHtml(input);
    expect(html).toContain("<b>Bold</b>");
    expect(html).toContain("<i>italic</i>");
    expect(html).toContain('href="https://cor.ca"');
  });

  it("removes script elements and their contents", () => {
    const { html } = sanitizeLegacyHtml('before<script>alert("xss")</script>after');
    expect(html).toBe("beforeafter");
    expect(html).not.toContain("alert");
  });

  it("removes an unclosed script tag", () => {
    const { html } = sanitizeLegacyHtml("before<script src='//evil.test/x.js'>after");
    expect(html).not.toContain("script");
    expect(html).not.toContain("evil.test");
  });

  it("removes iframes, objects, embeds and forms", () => {
    for (const tag of ["iframe", "object", "embed", "form"]) {
      const { html } = sanitizeLegacyHtml(`a<${tag} src="//evil.test">x</${tag}>b`);
      expect(html, tag).toBe("ab");
    }
  });

  it("strips inline event handlers in every quoting style", () => {
    expect(sanitizeLegacyHtml(`<div onclick="steal()">x</div>`).html).toBe("<div>x</div>");
    expect(sanitizeLegacyHtml(`<div onclick='steal()'>x</div>`).html).toBe("<div>x</div>");
    expect(sanitizeLegacyHtml(`<div onclick=steal()>x</div>`).html).toBe("<div>x</div>");
    expect(sanitizeLegacyHtml(`<img src="https://ok.test/a.png" onerror="steal()">`).html).not.toContain(
      "onerror"
    );
  });

  it("strips javascript: and data: URLs", () => {
    expect(sanitizeLegacyHtml(`<a href="javascript:alert(1)">x</a>`).html).not.toContain("javascript:");
    expect(sanitizeLegacyHtml(`<a href='vbscript:msgbox'>x</a>`).html).not.toContain("vbscript:");
    expect(sanitizeLegacyHtml(`<a href=data:text/html;base64,PHM+>x</a>`).html).not.toContain("data:");
  });

  it("strips style attributes carrying expression() payloads", () => {
    const { html } = sanitizeLegacyHtml(`<div style="width:expression(alert(1))">x</div>`);
    expect(html).not.toContain("expression");
  });

  it("keeps a benign style attribute", () => {
    const { html } = sanitizeLegacyHtml(`<div style="text-align: center;">x</div>`);
    expect(html).toContain('style="text-align: center;"');
  });

  // ---- dead legacy images ---------------------------------------------
  it("removes images hosted on the dead legacy domains and counts them", () => {
    const input =
      '<p>List:</p><img src="http://www.frumtoronto.com/Local/CalendarImages/costco_kfp.jpg" width="300">';
    const { html, removedImages } = sanitizeLegacyHtml(input);
    expect(html).not.toContain("<img");
    expect(removedImages).toBe(1);
    expect(html).toContain("<p>List:</p>");
  });

  it("removes relative images, which resolved against the old site", () => {
    const { removedImages } = sanitizeLegacyHtml('<img src="../prayer/bris.jpg">');
    expect(removedImages).toBe(1);
  });

  it("keeps images on hosts that may still work", () => {
    const { html, removedImages } = sanitizeLegacyHtml('<img src="https://cor.ca/logo.png">');
    expect(html).toContain("cor.ca/logo.png");
    expect(removedImages).toBe(0);
  });

  it("returns empty for nullish input", () => {
    expect(sanitizeLegacyHtml(null)).toEqual({ html: "", removedImages: 0 });
    expect(sanitizeLegacyHtml(undefined)).toEqual({ html: "", removedImages: 0 });
  });
});

describe("slugify", () => {
  it("produces a URL-safe slug", () => {
    expect(slugify("Halacha of the Week: The Mitzvah of Getting Drunk on Purim")).toBe(
      "halacha-of-the-week-the-mitzvah-of-getting-drunk-on-purim"
    );
  });

  it("collapses punctuation and repeated dashes", () => {
    expect(slugify("#5969 - Most Ingenious   Shiva Asar Betamuz?")).toBe(
      "5969-most-ingenious-shiva-asar-betamuz"
    );
  });

  it("has no leading or trailing dash", () => {
    expect(slugify("  -- Rosh Chodesh Sivan -- ")).toBe("rosh-chodesh-sivan");
  });

  it("survives a title that is entirely punctuation", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("classifyKosherAlert", () => {
  it("prefers recall over everything else", () => {
    expect(classifyKosherAlert("Product recall", "Do not consume")).toBe("recall");
  });

  it("detects a certification status change", () => {
    expect(classifyKosherAlert("Brand X", "is no longer certified by the OU")).toBe(
      "status_change"
    );
  });

  it("detects a warning", () => {
    expect(classifyKosherAlert("Mislabeled package", "please use caution")).toBe("warning");
  });

  it("falls back to update", () => {
    expect(classifyKosherAlert("2026 COR Passover Magazine", "The magazine is out")).toBe(
      "update"
    );
  });
});

describe("detectCertifyingAgency", () => {
  it("finds agencies by name", () => {
    expect(detectCertifyingAgency("MK Pesach Magazine 2026")).toBe("MK");
    expect(detectCertifyingAgency("2026 COR Passover Magazine")).toBe("COR");
    expect(detectCertifyingAgency("the OU will not be endorsing")).toBe("OU");
    expect(detectCertifyingAgency("Star-K advisory")).toBe("Star-K");
  });

  it("returns null when no agency is named", () => {
    expect(detectCertifyingAgency("Folgers Decaf Coffee")).toBeNull();
  });

  it("does not match an agency name inside a longer word", () => {
    expect(detectCertifyingAgency("Cookbook review")).toBeNull();
  });
});

describe("classifyMixedSimcha", () => {
  it("distinguishes bat from bar mitzvah", () => {
    expect(classifyMixedSimcha("Bat Mitzvah of Pearl", "")).toBe("bat-mitzvah");
    expect(classifyMixedSimcha("Bar Mitzvah of Shmuel", "")).toBe("bar-mitzvah");
  });

  it("prefers engagement when a notice mentions the upcoming marriage", () => {
    expect(
      classifyMixedSimcha("Engagement of A and B", "on their engagement and upcoming wedding")
    ).toBe("engagement");
  });

  it("detects births", () => {
    expect(classifyMixedSimcha("Mazel tov", "on the birth of a great-grandson")).toBe("birth");
  });

  it("detects weddings and aufrufs", () => {
    expect(classifyMixedSimcha("Aufruf", "on the Aufruf of their son")).toBe("wedding");
  });

  it("falls back to other", () => {
    expect(classifyMixedSimcha("Goldspeed.com on the front page", "Wall Street Journal")).toBe(
      "other"
    );
  });
});
