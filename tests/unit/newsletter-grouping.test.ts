import { describe, it, expect } from "vitest";
import {
  seriesSlug,
  groupSeries,
  selectSeries,
  byPublisher,
  byShul,
  shouldGroup,
  flattenSeries,
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
  const seriesFrom = (rows: Row[]) => groupSeries(rows, byPublisher);
  const issue = (id: number, publisher: string, day: number) =>
    row({ id, publisher, publishedAt: new Date(2026, 7, day) });

  it("does not group when every series has a single issue", () => {
    expect(
      shouldGroup(seriesFrom([issue(1, "A", 1), issue(2, "B", 2)]))
    ).toBe(false);
  });

  it("does not group when only a minority have a back catalogue", () => {
    // The live shul side: Ahavat Shalom has 2, four other shuls have 1 each.
    // Grouping produced five headings, four of them over a lone card.
    const rows = [
      issue(1, "Ahavat Shalom", 1),
      issue(2, "Ahavat Shalom", 8),
      issue(3, "Bnai Torah", 2),
      issue(4, "JEP", 3),
      issue(5, "Kollel Yad Yosef", 4),
      issue(6, "Clanton Park", 5),
    ];
    expect(shouldGroup(seriesFrom(rows))).toBe(false);
  });

  it("groups when most series have a back catalogue", () => {
    const rows = [
      issue(1, "A", 1),
      issue(2, "A", 8),
      issue(3, "B", 2),
      issue(4, "B", 9),
      issue(5, "C", 3),
    ];
    expect(shouldGroup(seriesFrom(rows))).toBe(true);
  });

  it("groups a single series with a back catalogue — the Israel News case", () => {
    expect(
      shouldGroup(seriesFrom([issue(1, "Israel News", 1), issue(2, "Israel News", 8)]))
    ).toBe(true);
  });

  it("does not group nothing", () => {
    expect(shouldGroup([])).toBe(false);
  });
});

describe("flattenSeries", () => {
  const issue = (id: number, publisher: string, day: number) =>
    row({ id, publisher, publishedAt: new Date(2026, 7, day) });

  it("returns every issue, not one per series", () => {
    // The counterpart to shouldGroup. When grouping is off the page renders a
    // flat grid, and rendering series.latest there silently drops the back
    // catalogue: six shul newsletters, five cards, with nothing to indicate a
    // newsletter had gone missing. shouldGroup is a MAJORITY rule, so a series
    // with two issues sitting among four with one each hits exactly this.
    const rows = [
      issue(1, "Ahavat Shalom", 1),
      issue(2, "Ahavat Shalom", 8),
      issue(3, "Bnai Torah", 2),
      issue(4, "JEP", 3),
      issue(5, "Kollel Yad Yosef", 4),
      issue(6, "Clanton Park", 5),
    ];

    expect(flattenSeries(groupSeries(rows, byPublisher))).toHaveLength(6);
  });

  it("orders across series by date, not series by series", () => {
    // A flat grid has no headings, so grouping order would read as arbitrary.
    const rows = [
      issue(1, "A", 1),
      issue(2, "B", 9),
      issue(3, "A", 5),
    ];

    expect(flattenSeries(groupSeries(rows, byPublisher)).map((r) => r.id)).toEqual([
      2, 3, 1,
    ]);
  });

  it("drops nothing that grouping capped", () => {
    // A capped series reports hasMore; flattening past the cap would be a lie
    // the flat grid cannot signal, so the cap is honoured and nothing more.
    const rows = Array.from({ length: 20 }, (_, i) =>
      issue(i + 1, "A", (i % 28) + 1)
    );
    const series = groupSeries(rows, byPublisher, { pastLimit: 12 });

    expect(flattenSeries(series)).toHaveLength(13);
  });
});
