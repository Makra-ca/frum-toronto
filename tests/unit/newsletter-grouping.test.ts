import { describe, it, expect } from "vitest";
import {
  seriesSlug,
  groupSeries,
  selectSeries,
  byPublisher,
  byShul,
  OTHER_SLUG,
  type Row,
} from "@/lib/newsletters/group-series";

// Readers asked where "Israel News" went. This module turns a flat, date-sorted
// list into named series so the answer is a heading and a link rather than
// "scroll and look".
//
// Every rule below is a real bug if missed, which is why they are each pinned.

const row = (o: Partial<Row> & { id: number }): Row => ({
  publisher: "Israel News",
  title: "t",
  fileUrl: "u",
  publishedAt: new Date("2026-08-03"),
  isActive: true,
  ...o,
});

describe("seriesSlug", () => {
  it("makes a URL-safe slug from a name", () => {
    expect(seriesSlug("Israel News")).toBe("israel-news");
    expect(seriesSlug("Clanton Park Synagogue")).toBe("clanton-park-synagogue");
  });

  it("matches regardless of spacing or case, so a shared link keeps working", () => {
    expect(seriesSlug("  israel   NEWS ")).toBe("israel-news");
  });

  it("gives rows with no key a stable slug", () => {
    expect(seriesSlug(null)).toBe(OTHER_SLUG);
    expect(seriesSlug("")).toBe(OTHER_SLUG);
    expect(seriesSlug("   ")).toBe(OTHER_SLUG);
  });

  it("does not produce an empty slug from punctuation alone", () => {
    expect(seriesSlug("!!!")).toBe(OTHER_SLUG);
  });
});

describe("groupSeries", () => {
  it("collects issues of one publisher into a series, newest first", () => {
    const [series] = groupSeries(
      [
        row({ id: 1, publishedAt: new Date("2026-07-27") }),
        row({ id: 2, publishedAt: new Date("2026-08-03") }),
      ],
      byPublisher
    );
    expect(series.slug).toBe("israel-news");
    expect(series.name).toBe("Israel News");
    expect(series.latest.id).toBe(2);
    expect(series.past.map((r) => r.id)).toEqual([1]);
  });

  it("keeps Israel News and Israeli News as separate series", () => {
    // The datalist on the admin form is what prevents this in practice.
    // Pinned so nobody later 'fixes' it with fuzzy matching and silently
    // merges two genuinely different publishers.
    const groups = groupSeries(
      [
        row({ id: 1, publisher: "Israel News" }),
        row({ id: 2, publisher: "Israeli News" }),
      ],
      byPublisher
    );
    expect(groups).toHaveLength(2);
  });

  it("puts Other last, however recent its newest issue", () => {
    const groups = groupSeries(
      [
        row({ id: 1, publisher: null, publishedAt: new Date("2026-08-10") }),
        row({ id: 2, publisher: "Israel News", publishedAt: new Date("2026-08-03") }),
      ],
      byPublisher
    );
    expect(groups.map((g) => g.slug)).toEqual(["israel-news", OTHER_SLUG]);
  });

  it("sorts an undated newsletter last, not first", () => {
    // Postgres sorts NULLs FIRST under desc(), which would float a dateless
    // newsletter above the current week.
    const [series] = groupSeries(
      [
        row({ id: 1, publishedAt: null }),
        row({ id: 2, publishedAt: new Date("2026-08-03") }),
      ],
      byPublisher
    );
    expect(series.latest.id).toBe(2);
  });

  it("breaks a tie on id, so a bulk upload has a stable order", () => {
    const same = new Date("2026-08-03");
    const [series] = groupSeries(
      [row({ id: 1, publishedAt: same }), row({ id: 2, publishedAt: same })],
      byPublisher
    );
    expect(series.latest.id).toBe(2);
  });

  it("excludes inactive newsletters entirely", () => {
    expect(groupSeries([row({ id: 1, isActive: false })], byPublisher)).toHaveLength(0);
  });

  it("groups shul newsletters by shul with the same rules", () => {
    // The reason the module takes a key function: a reader hunting their own
    // shul's newsletter has exactly the problem the Israel News emails describe.
    const groups = groupSeries(
      [
        { id: 1, title: "Devarim", fileUrl: "u", publishedAt: new Date("2026-07-17"), isActive: true, shulName: "Ahavat Shalom" },
        { id: 2, title: "Devarim", fileUrl: "u", publishedAt: new Date("2026-07-17"), isActive: true, shulName: "Bnai Torah Congregation" },
      ],
      byShul
    );
    expect(groups.map((g) => g.slug).sort()).toEqual([
      "ahavat-shalom",
      "bnai-torah-congregation",
    ]);
  });

  it("caps past issues and reports the overflow", () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      row({ id: i + 1, publishedAt: new Date(2026, 0, i + 1) })
    );
    const [series] = groupSeries(rows, byPublisher, { pastLimit: 12 });
    expect(series.past).toHaveLength(12);
    expect(series.hasMore).toBe(true);
  });

  it("returns every past issue uncapped, so 'see all' is not a dead end", () => {
    // The filtered view passes Infinity. Without this the 'see all' link goes
    // to a page applying the same cap — linking to itself, with issue 14 still
    // unreachable, which is the exact failure the link exists to prevent.
    const rows = Array.from({ length: 20 }, (_, i) =>
      row({ id: i + 1, publishedAt: new Date(2026, 0, i + 1) })
    );
    const [series] = groupSeries(rows, byPublisher, {
      pastLimit: Number.POSITIVE_INFINITY,
    });
    expect(series.past).toHaveLength(19);
    expect(series.hasMore).toBe(false);
  });

  it("preserves the caller's row type, so the cards keep their columns", () => {
    // Series is generic in T. A bare Row would drop fileSize/description and
    // the page would not compile.
    const [series] = groupSeries(
      [{ ...row({ id: 1 }), fileSize: 2048, shulSlug: "x" }],
      byPublisher
    );
    expect(series.latest.fileSize).toBe(2048);
  });
});

describe("selectSeries", () => {
  const groups = () =>
    groupSeries([row({ id: 1 }), row({ id: 2, publisher: "BAYT" })], byPublisher);

  it("selects one series by slug for the shareable link", () => {
    expect(selectSeries(groups(), "israel-news")).toHaveLength(1);
  });

  it("resolves an unslugified param, so a hand-typed link still works", () => {
    expect(selectSeries(groups(), "Israel News")).toHaveLength(1);
  });

  it("returns nothing for an unknown slug, so the page can offer the full list", () => {
    expect(selectSeries(groups(), "made-up")).toEqual([]);
  });

  it("treats a missing or empty param as no filter", () => {
    // Must not be `param !== undefined` at the call site, or `?publisher=`
    // would hide the shul section for an empty value.
    expect(selectSeries(groups(), undefined)).toHaveLength(2);
    expect(selectSeries(groups(), "")).toHaveLength(2);
  });
});

describe("shouldGroup", () => {
  it("does not group while every series has a single issue", () => {
    // Live data today: four shuls with one newsletter each. Grouping would
    // turn a tidy card grid into four headings over four lone cards.
    const single = groupSeries(
      [row({ id: 1, publisher: "A" }), row({ id: 2, publisher: "B" })],
      byPublisher
    );
    expect(single.some((s) => s.past.length > 0)).toBe(false);
  });

  it("groups once any series has more than one issue", () => {
    const mixed = groupSeries(
      [
        row({ id: 1, publisher: "A", publishedAt: new Date("2026-08-01") }),
        row({ id: 2, publisher: "A", publishedAt: new Date("2026-08-08") }),
        row({ id: 3, publisher: "B" }),
      ],
      byPublisher
    );
    expect(mixed.some((s) => s.past.length > 0)).toBe(true);
  });
});
