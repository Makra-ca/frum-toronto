import { describe, it, expect } from "vitest";
import { paginationItems } from "../../src/lib/pagination-items";

const render = (items: (number | "ellipsis")[]) =>
  items.map((i) => (i === "ellipsis" ? "…" : String(i))).join(" ");

describe("paginationItems", () => {
  it("returns nothing when there are no pages", () => {
    expect(paginationItems(1, 0)).toEqual([]);
  });

  it("returns a single page unchanged", () => {
    expect(paginationItems(1, 1)).toEqual([1]);
  });

  it("shows every page when they all fit, with no ellipsis", () => {
    for (let total = 2; total <= 7; total++) {
      const items = paginationItems(1, total);
      expect(items).toHaveLength(total);
      expect(items).not.toContain("ellipsis");
      expect(items[0]).toBe(1);
      expect(items.at(-1)).toBe(total);
    }
  });

  /**
   * The property that matters: a constant item count. The old logic swung from 4
   * to 7 items, which changed the control's width and moved the Next button
   * under the user's cursor while paging.
   */
  it("returns a constant number of items at every page of a long list", () => {
    const total = 690;
    const counts = new Set<number>();
    for (let page = 1; page <= total; page++) {
      counts.add(paginationItems(page, total).length);
    }
    expect([...counts]).toEqual([7]);
  });

  it("keeps the count constant for many different list lengths", () => {
    for (const total of [8, 9, 12, 25, 64, 158, 690, 5000]) {
      const counts = new Set<number>();
      for (let page = 1; page <= total; page++) {
        counts.add(paginationItems(page, total).length);
      }
      expect([...counts], `total=${total}`).toEqual([7]);
    }
  });

  it("always offers the first and last page", () => {
    const total = 690;
    for (const page of [1, 2, 5, 50, 344, 688, 690]) {
      const items = paginationItems(page, total);
      expect(items, `page=${page}`).toContain(1);
      expect(items, `page=${page}`).toContain(total);
    }
  });

  it("always includes the current page", () => {
    const total = 690;
    for (let page = 1; page <= total; page += 7) {
      expect(paginationItems(page, total), `page=${page}`).toContain(page);
    }
  });

  it("renders the expected strips near the start, middle and end", () => {
    const total = 690;
    expect(render(paginationItems(1, total))).toBe("1 2 3 4 5 … 690");
    expect(render(paginationItems(3, total))).toBe("1 2 3 4 5 … 690");
    expect(render(paginationItems(50, total))).toBe("1 … 49 50 51 … 690");
    expect(render(paginationItems(688, total))).toBe("1 … 686 687 688 689 690");
    expect(render(paginationItems(690, total))).toBe("1 … 686 687 688 689 690");
  });

  it("gives more than one forward destination from page 1", () => {
    // The old behaviour offered only page 2 and the last page.
    const items = paginationItems(1, 690).filter((i): i is number => i !== "ellipsis");
    const forward = items.filter((p) => p > 1 && p < 690);
    expect(forward.length).toBeGreaterThan(1);
  });

  it("never emits a page outside the valid range", () => {
    for (const total of [8, 20, 690]) {
      for (let page = 1; page <= total; page++) {
        for (const item of paginationItems(page, total)) {
          if (item === "ellipsis") continue;
          expect(item, `page=${page} total=${total}`).toBeGreaterThanOrEqual(1);
          expect(item, `page=${page} total=${total}`).toBeLessThanOrEqual(total);
        }
      }
    }
  });

  it("emits strictly ascending page numbers with no duplicates", () => {
    for (const total of [8, 20, 158, 690]) {
      for (let page = 1; page <= total; page++) {
        const nums = paginationItems(page, total).filter(
          (i): i is number => i !== "ellipsis"
        );
        for (let i = 1; i < nums.length; i++) {
          expect(nums[i], `page=${page} total=${total}`).toBeGreaterThan(nums[i - 1]);
        }
      }
    }
  });

  it("only uses an ellipsis where pages are actually skipped", () => {
    for (const total of [8, 20, 690]) {
      for (let page = 1; page <= total; page++) {
        const items = paginationItems(page, total);
        items.forEach((item, idx) => {
          if (item !== "ellipsis") return;
          const before = items[idx - 1];
          const after = items[idx + 1];
          expect(typeof before).toBe("number");
          expect(typeof after).toBe("number");
          // A gap of exactly 1 would mean the ellipsis hides nothing and should
          // have been that page number instead.
          expect((after as number) - (before as number)).toBeGreaterThan(1);
        });
      }
    }
  });

  it("clamps an out-of-range current page instead of producing bad output", () => {
    const total = 20;
    expect(paginationItems(0, total)).toEqual(paginationItems(1, total));
    expect(paginationItems(-5, total)).toEqual(paginationItems(1, total));
    expect(paginationItems(9999, total)).toEqual(paginationItems(total, total));
  });
});
