import { describe, it, expect } from "vitest";
import { buildSheetLines } from "@/lib/zmanim-sheet";
import { TORONTO_LOCATION } from "@/lib/zmanim-location";

const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
const rows = (l: ReturnType<typeof buildSheetLines>) => l.filter((x) => x.kind === "day");
const notes = (l: ReturnType<typeof buildSheetLines>) => l.filter((x) => x.kind === "footnote");

describe("buildSheetLines", () => {
  const august = buildSheetLines(day(2026, 8, 1), day(2026, 8, 31), TORONTO_LOCATION, day(2026, 8, 5));

  it("emits one day row per civil day", () => {
    expect(rows(august)).toHaveLength(31);
  });

  it("strips the year from the Hebrew date", () => {
    const first = rows(august)[0];
    expect(first.kind === "day" && first.hebrewDateShort).toBe("18 Av");
  });

  it("flags exactly one row as today", () => {
    expect(rows(august).filter((r) => r.kind === "day" && r.isToday)).toHaveLength(1);
  });

  it("places the molad footnote directly after its own day row", () => {
    const i = august.findIndex((l) => l.kind === "footnote" && /Molad for Elul/.test(l.text));
    expect(i).toBeGreaterThan(0);
    const before = august[i - 1];
    expect(before.kind).toBe("day");
    expect(before.kind === "day" && before.date.toISOString().slice(0, 10)).toBe("2026-08-13");
  });

  it("includes both footnotes for August 2026", () => {
    expect(notes(august).filter((n) => n.kind === "footnote" && /Molad|Kiddush Levanoh/.test(n.text)))
      .toHaveLength(2);
  });

  it("omits footnotes falling outside the range", () => {
    const short = buildSheetLines(day(2026, 8, 1), day(2026, 8, 10), TORONTO_LOCATION, day(2026, 8, 5));
    expect(notes(short)).toHaveLength(0);
  });

  it("labels Rosh Chodesh on its row", () => {
    const rc = rows(august).find((r) => r.kind === "day" && r.date.getUTCDate() === 13);
    expect(rc!.kind === "day" && rc!.labels.join(" ")).toMatch(/Rosh Chodesh/);
  });

  // The whole justification for labelsForDate replacing specialDay: a day that
  // is both Rosh Chodesh and Chanukah must keep BOTH labels, where specialDay
  // (last-write-wins) collapses them to one arbitrary string.
  it("keeps both labels on a day that is Rosh Chodesh and Chanukah", () => {
    const dec = buildSheetLines(day(2026, 12, 1), day(2026, 12, 31), TORONTO_LOCATION, day(2026, 12, 1));
    const multi = dec.filter(
      (l) => l.kind === "day" && l.labels.length > 1
    );
    expect(multi.length).toBeGreaterThan(0);
  });

  it("puts daf yomi on every row", () => {
    expect(rows(august).every((r) => r.kind === "day" && typeof r.dafYomi === "string")).toBe(true);
  });

  // Fast days: neither fast time is among the seventeen columns, and the two
  // Alos columns are ~15 min apart with nothing saying which starts the fast.
  it("emits fast begins/ends as a footnote on a fast day", () => {
    const sept = buildSheetLines(day(2026, 9, 1), day(2026, 9, 30), TORONTO_LOCATION, day(2026, 9, 5));
    const fast = sept.find((l) => l.kind === "footnote" && /Fast begins/.test(l.text));
    expect(fast).toBeDefined();
    expect(fast!.kind === "footnote" && fast!.text).toMatch(/Fast ends/);
  });
});
