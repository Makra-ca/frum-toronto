import { describe, it, expect } from "vitest";
import {
  parseAtrTab,
  ATR_TABS,
  DEFAULT_ATR_TAB,
} from "@/components/ask-the-rabbi/manage/atr-tabs";

describe("parseAtrTab", () => {
  it("defaults when nothing is supplied", () => {
    expect(parseAtrTab(null)).toBe(DEFAULT_ATR_TAB);
    expect(parseAtrTab(undefined)).toBe(DEFAULT_ATR_TAB);
    expect(parseAtrTab("")).toBe(DEFAULT_ATR_TAB);
  });

  it("accepts every known slug", () => {
    for (const t of ATR_TABS) {
      expect(parseAtrTab(t.key)).toBe(t.key);
    }
  });

  it("falls back rather than rendering nothing for junk", () => {
    expect(parseAtrTab("../etc/passwd")).toBe(DEFAULT_ATR_TAB);
    expect(parseAtrTab("QUESTIONS")).toBe(DEFAULT_ATR_TAB);
    expect(parseAtrTab("submission")).toBe(DEFAULT_ATR_TAB);
  });

  it("exposes four tabs with unique keys", () => {
    expect(ATR_TABS).toHaveLength(4);
    expect(new Set(ATR_TABS.map((t) => t.key)).size).toBe(4);
  });
});
