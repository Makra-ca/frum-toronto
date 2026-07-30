import type { AdPlacement } from "@/lib/ads/live-ads";

/**
 * How much of a slot an image will actually cover, and whether that is bad
 * enough to warn about.
 *
 * ## Why a fill fraction rather than a ratio threshold
 *
 * The obvious rule is "warn if the image is portrait and the slot is the
 * banner". That is both too crude and wrong in one direction: a 4:3 landscape
 * image is not portrait, yet it still covers barely half the banner, while a
 * square image in a sidebar is fine even though its ratio is nowhere near the
 * slot's.
 *
 * What actually matters is the proportion of the slot left empty once the image
 * is letterboxed (`object-contain` never crops, by decision). That is computable
 * exactly, so it is computed rather than approximated by rules of thumb.
 *
 * ## Where the slot ratios come from
 *
 * Measured in a browser against the real rendered components, not inferred from
 * the Tailwind classes:
 *
 *   banner   — full container width x h-32/40/48   -> ~7.8 (very wide)
 *   sidebar  — 200px column x h-64                 -> ~0.78 (slightly portrait)
 *
 * Note the sidebars are *taller than they are wide*. That is easy to get
 * backwards: the intuition "sidebar = small, so send a small wide image" is
 * exactly wrong, and a wide banner-style image wastes ~80% of a sidebar.
 */
export const SLOT_RATIOS: Record<AdPlacement, number> = {
  banner: 7.8,
  "sidebar-left": 0.78,
  "sidebar-right": 0.78,
};

/** Below this share of the slot covered, the artwork is badly mismatched. */
const SEVERE_FILL = 0.35;
/** Below this, it is worth mentioning but not alarming. */
const MILD_FILL = 0.6;

export type AspectSeverity = "severe" | "mild";

export interface AspectWarning {
  severity: AspectSeverity;
  /** Share of the slot the image will cover, 0-1. */
  fill: number;
  message: string;
}

/**
 * The share of the slot an image covers once letterboxed into it.
 *
 * The image scales until the first dimension touches, so the leftover is the
 * ratio mismatch in whichever direction it runs.
 */
export function slotFill(imageRatio: number, slotRatio: number): number {
  if (!Number.isFinite(imageRatio) || imageRatio <= 0) return 0;
  if (!Number.isFinite(slotRatio) || slotRatio <= 0) return 0;
  return imageRatio > slotRatio ? slotRatio / imageRatio : imageRatio / slotRatio;
}

/**
 * Returns a warning when artwork suits a position badly, or null when it is fine.
 *
 * Deliberately advisory: a letterboxed flyer is a legitimate choice, and the
 * overlay carries the detail anyway. The point is that nobody discovers the
 * problem by looking at the live homepage.
 */
export function aspectWarning(
  placement: AdPlacement,
  width: number,
  height: number
): AspectWarning | null {
  if (!width || !height) return null;

  const imageRatio = width / height;
  const slotRatio = SLOT_RATIOS[placement];
  const fill = slotFill(imageRatio, slotRatio);

  if (fill >= MILD_FILL) return null;

  const percent = Math.round(fill * 100);
  const isBanner = placement === "banner";
  const tooTall = imageRatio < slotRatio;

  // Name the fix, not just the problem — "this is wrong" without "do this
  // instead" is what makes a warning something people click past.
  const suggestion = isBanner
    ? tooTall
      ? "Crop it to a wide strip, or place it in a sidebar, which is taller than it is wide."
      : "Crop it wider, or place it in a sidebar."
    : tooTall
      ? "Crop it less tall, or place it in the banner."
      : "Sidebars are taller than they are wide — crop this to a square or portrait shape, or place it in the banner.";

  return {
    severity: fill < SEVERE_FILL ? "severe" : "mild",
    fill,
    message: `This image will cover about ${percent}% of the ${
      isBanner ? "banner" : "sidebar"
    } slot; the rest will be empty space. ${suggestion}`,
  };
}
