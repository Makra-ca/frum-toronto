/**
 * Tab slugs for the Ask the Rabbi management screens.
 *
 * Deliberately plain TypeScript — no "use client", no React, no component
 * imports. The unit test project runs in a Node environment with no DOM, and
 * keeping this file free of the component tree is what guarantees the test
 * stays runnable no matter what those components later import.
 */

export const ATR_TABS = [
  { key: "submissions", label: "Submissions" },
  { key: "questions", label: "Questions" },
  { key: "new", label: "New" },
  { key: "comments", label: "Comments" },
] as const;

export type AtrTab = (typeof ATR_TABS)[number]["key"];

export const DEFAULT_ATR_TAB: AtrTab = "submissions";

/** Map a ?tab= value to a known slug, falling back rather than rendering nothing. */
export function parseAtrTab(value: string | null | undefined): AtrTab {
  const match = ATR_TABS.find((t) => t.key === value);
  return match ? match.key : DEFAULT_ATR_TAB;
}
