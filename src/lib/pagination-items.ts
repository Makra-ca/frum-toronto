export type PaginationItem = number | "ellipsis";

/**
 * Total items rendered (page numbers plus ellipses).
 *
 * Constant by design. The previous logic showed first + last + current±1, which
 * swung between 4 and 7 items as you moved through the list — so the control
 * changed width and the Next button physically moved out from under the cursor
 * while paging through. A fixed count keeps it still.
 *
 * 7 rather than 9: at min-w-9 per button plus gap-2, seven slots come to roughly
 * 300px and still fit a 375px phone without the row wrapping.
 */
const SLOTS = 7;

/** Numbers shown in the middle case, i.e. current page ± 1. */
const WINDOW = 3;

/**
 * Builds the page-number strip for PaginationLinks.
 *
 * Always returns exactly SLOTS entries once there are more than SLOTS pages, so
 * the rendered control has a stable width. First and last are always reachable;
 * the rest is a window that slides with the current page.
 *
 *   page   1 of 690 -> 1 2 3 4 5 … 690
 *   page  50 of 690 -> 1 … 49 50 51 … 690
 *   page 690 of 690 -> 1 … 686 687 688 689 690
 */
export function paginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 1) return totalPages === 1 ? [1] : [];

  // Few enough to show them all.
  if (totalPages <= SLOTS) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const clamped = Math.min(Math.max(currentPage, 1), totalPages);

  // How many leading/trailing numbers fit when only one ellipsis is needed:
  // SLOTS minus the ellipsis and the single far-end page.
  const edgeRun = SLOTS - 2;

  // Near the start: 1..edgeRun, ellipsis, last.
  if (clamped <= edgeRun - 1) {
    return [
      ...Array.from({ length: edgeRun }, (_, i) => i + 1),
      "ellipsis",
      totalPages,
    ];
  }

  // Near the end: 1, ellipsis, last-(edgeRun-1)..last.
  if (clamped >= totalPages - (edgeRun - 2)) {
    return [
      1,
      "ellipsis",
      ...Array.from({ length: edgeRun }, (_, i) => totalPages - edgeRun + 1 + i),
    ];
  }

  // Middle: 1, ellipsis, window around current, ellipsis, last.
  const half = Math.floor(WINDOW / 2);
  return [
    1,
    "ellipsis",
    ...Array.from({ length: WINDOW }, (_, i) => clamped - half + i),
    "ellipsis",
    totalPages,
  ];
}
