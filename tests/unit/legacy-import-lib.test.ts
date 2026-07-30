import { describe, it, expect, afterAll } from "vitest";
import {
  oleToDateString,
  oleToTimestamp,
  addDaysToDateString,
  htmlToText,
  htmlToLine,
  fit,
  chunk,
} from "../../scripts/legacy-import/lib";

describe("oleToDateString", () => {
  it("converts known legacy serials to the right calendar date", () => {
    // Anchors taken from live legacy rows during exploration: BlogEntryID 36248
    // (Births) reported 2026-05-15, and the Diary epoch is days since 1899-12-30.
    expect(oleToDateString(25569)).toBe("1970-01-01");
    expect(oleToDateString(0)).toBe("1899-12-30");
    expect(oleToDateString(1)).toBe("1899-12-31");
  });

  it("ignores the fractional time-of-day", () => {
    expect(oleToDateString(45000.0)).toBe(oleToDateString(45000.999));
  });

  it("returns null for missing or non-finite input", () => {
    expect(oleToDateString(null)).toBeNull();
    expect(oleToDateString(undefined)).toBeNull();
    expect(oleToDateString(NaN)).toBeNull();
    expect(oleToDateString(Infinity)).toBeNull();
  });

  // This is the regression guard that matters. The same class of bug (reading a
  // Date's local components to decide a calendar day) produced wrong Hebrew
  // dates and zmanim in this repo, and does not reproduce on a Toronto laptop.
  const ORIGINAL_TZ = process.env.TZ;
  afterAll(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  it("produces the same date regardless of the machine timezone", () => {
    const serials = [25569, 40000, 45000.75, 46000.25];
    const zones = ["UTC", "Asia/Tokyo", "Asia/Kolkata", "America/Toronto", "America/Los_Angeles"];

    const baseline = serials.map((s) => oleToDateString(s));

    for (const tz of zones) {
      process.env.TZ = tz;
      const got = serials.map((s) => oleToDateString(s));
      expect(got, `timezone ${tz} disagreed`).toEqual(baseline);
    }
  });
});

describe("oleToTimestamp", () => {
  it("keeps the time-of-day component", () => {
    const noon = oleToTimestamp(25569.5);
    expect(noon?.toISOString()).toBe("1970-01-01T12:00:00.000Z");
  });

  it("orders consistently with the serial", () => {
    const a = oleToTimestamp(40000)!;
    const b = oleToTimestamp(40001)!;
    expect(a.getTime()).toBeLessThan(b.getTime());
  });

  it("returns null for missing input", () => {
    expect(oleToTimestamp(null)).toBeNull();
    expect(oleToTimestamp(NaN)).toBeNull();
  });
});

describe("addDaysToDateString", () => {
  it("adds days without timezone drift", () => {
    expect(addDaysToDateString("2026-03-27", 7)).toBe("2026-04-03");
    expect(addDaysToDateString("2026-12-29", 7)).toBe("2027-01-05");
  });

  it("crosses a DST boundary correctly", () => {
    // North American DST starts 2026-03-08; a local-time implementation can
    // land on the wrong day here.
    expect(addDaysToDateString("2026-03-06", 7)).toBe("2026-03-13");
  });

  it("handles a leap day", () => {
    expect(addDaysToDateString("2028-02-26", 7)).toBe("2028-03-04");
  });
});

describe("htmlToText", () => {
  it("decodes the ampersand entity the legacy editor emitted everywhere", () => {
    // Verbatim from legacy Births row 36187.
    const input =
      "Mazal Tov to Daniel &amp; Leah Guttman on the birth of a baby girl<br />\r\nMazal Tov to grandparents David &amp; Cheryl Jenah";
    const out = htmlToText(input);
    expect(out).toContain("Daniel & Leah Guttman");
    expect(out).not.toContain("&amp;");
    expect(out).not.toContain("<br");
  });

  it("decodes numeric Hebrew entities", () => {
    // Verbatim from legacy Births row 36187: טובים ולמעשים לחופה לתורה
    const input = "&#1496;&#1493;&#1489;&#1497;&#1501;";
    expect(htmlToText(input)).toBe("טובים");
  });

  it("decodes hex numeric entities", () => {
    expect(htmlToText("&#x5D0;")).toBe("א");
  });

  it("turns block boundaries into newlines", () => {
    expect(htmlToText("a<br>b")).toBe("a\nb");
    expect(htmlToText("a<br />b")).toBe("a\nb");
    expect(htmlToText("<p>one</p>two")).toBe("one\ntwo");
  });

  it("separates adjacent block elements with a paragraph break", () => {
    // Both the closing and the opening tag contribute a newline, which is the
    // right reading of two sibling divs. The \n{3,} collapse keeps it bounded
    // no matter how much wrapper markup the legacy editor nested.
    expect(htmlToText("<div>one</div><div>two</div>")).toBe("one\n\ntwo");
    expect(htmlToText("<div><div><div>one</div></div></div><div>two</div>")).toBe("one\n\ntwo");
  });

  it("strips nbsp into ordinary spaces", () => {
    const input = "May we continue to share in many more simchos together.&nbsp;";
    expect(htmlToText(input)).toBe("May we continue to share in many more simchos together.");
  });

  it("collapses the trailing whitespace legacy rows are full of", () => {
    expect(htmlToText("\r\nHello<br />\r\n<br />\r\n\r\n")).toBe("Hello");
  });

  // ---- Windows-1252 numeric entities ----------------------------------
  // The legacy site was authored in Windows-1252 and stored punctuation as
  // cp1252 byte values. Decoding those as Unicode code points yields invisible
  // C1 control characters — this silently corrupted 1,168 of the 16,542 simcha
  // rows on the first import pass, so these are regression guards.
  it("maps cp1252 numeric entities to real punctuation", () => {
    expect(htmlToText("Canada&#146;s MK Pesach Magazine")).toBe("Canada’s MK Pesach Magazine");
    expect(htmlToText("&#147;quoted&#148;")).toBe("“quoted”");
    expect(htmlToText("dash &#150; here")).toBe("dash – here");
    expect(htmlToText("em &#151; dash")).toBe("em — dash");
    expect(htmlToText("bullet &#149;")).toBe("bullet •");
  });

  it("accepts numeric entities the legacy editor left unterminated", () => {
    // Verbatim from legacy simcha rows 12 and 673.
    expect(htmlToText("Tizki L&#146Mitzvos!!")).toBe("Tizki L’Mitzvos!!");
    expect(htmlToText("May He grow L&#146Torah, L&#146Chupah")).toBe(
      "May He grow L’Torah, L’Chupah"
    );
  });

  it("leaves no C1 control characters in the output", () => {
    // 129 and 157 are unassigned in cp1252, so they must be dropped rather than
    // emitted as invisible control characters.
    const out = htmlToText("Bayis Ne&#146eman B&#146Yisrael &#146; &#129; &#157;");
    expect(out).not.toMatch(/[\u0080-\u009F]/);
    expect(out).toContain("Bayis Ne\u2019eman B\u2019Yisrael");
  });

  it("strips stray C1 bytes that arrived as raw characters, not entities", () => {
    const raw = `a${String.fromCharCode(0x92)}b${String.fromCharCode(0x85)}c`;
    expect(raw).toMatch(/[\u0080-\u009F]/); // the input really does contain them
    expect(htmlToText(raw)).toBe("abc");
  });

  // ---- Double-encoded legacy rows -------------------------------------
  it("fully decodes double-encoded markup", () => {
    // Legacy row 3210 stored "&lt;br&gt;&lt;br&gt;", which one pass would leave
    // on screen as a literal "<br><br>".
    expect(htmlToText("line&lt;br&gt;next")).toBe("line\nnext");
    // Legacy row 32336 stored "&amp;amp;".
    expect(htmlToText("Mr. &amp;amp; Mrs. Ochs")).toBe("Mr. & Mrs. Ochs");
  });

  it("reaches a fixed point rather than looping forever", () => {
    // A string that keeps producing an ampersand must still terminate.
    const out = htmlToText("&amp;amp;amp;amp;amp; end");
    expect(out).toContain("end");
    expect(out.length).toBeLessThan(40);
  });

  it("leaves unknown entities untouched rather than mangling them", () => {
    expect(htmlToText("&notarealentity; x")).toBe("&notarealentity; x");
  });

  it("removes script and style blocks entirely", () => {
    expect(htmlToText("a<script>alert(1)</script>b")).toBe("ab");
    expect(htmlToText("a<style>.x{}</style>b")).toBe("ab");
  });

  it("returns empty string for nullish input", () => {
    expect(htmlToText(null)).toBe("");
    expect(htmlToText(undefined)).toBe("");
    expect(htmlToText("")).toBe("");
  });

  it("handles a full real announcement end to end", () => {
    const input =
      "\r\nMazel Tov to Rabbi &amp; Mrs. Yechezkel &amp; Rivkie Reichmann on the engagement of their son, Elimelech, to Shaindy Follman of Lakewood, NJ.\r\n";
    expect(htmlToText(input)).toBe(
      "Mazel Tov to Rabbi & Mrs. Yechezkel & Rivkie Reichmann on the engagement of their son, Elimelech, to Shaindy Follman of Lakewood, NJ."
    );
  });
});

describe("htmlToLine", () => {
  it("collapses newlines so the value fits a single-line column", () => {
    expect(htmlToLine("<div>one</div><div>two</div>")).toBe("one two");
    expect(htmlToLine("a<br /><br />b")).toBe("a b");
  });
});

describe("fit", () => {
  it("leaves short values alone", () => {
    expect(fit("abc", 10)).toBe("abc");
  });

  it("truncates to the limit", () => {
    expect(fit("abcdef", 3)).toBe("abc");
  });

  it("does not split a surrogate pair", () => {
    // Naive slice(0,1) on an astral char yields a lone surrogate, which
    // Postgres rejects as invalid UTF-8.
    const out = fit("👶👶👶", 2);
    expect(Array.from(out)).toHaveLength(2);
    expect(out).toBe("👶👶");
  });
});

describe("chunk", () => {
  it("splits evenly and keeps the remainder", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns empty for empty input", () => {
    expect(chunk([], 10)).toEqual([]);
  });
});
