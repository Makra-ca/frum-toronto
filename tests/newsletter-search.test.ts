import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { communityNewsletters, shulDocuments, shuls } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { searchNewsletters } from "@/lib/search/fuzzy-search";

// Newsletters were in no search index at all, so the literal question three
// readers asked — "where can I find Israel News" — had no answerable reply.
// These tests pin that a series is findable by the words a reader would type,
// and that the result lands on the series rather than the bare page.

const newsletterIds: number[] = [];
const shulDocIds: number[] = [];
let shulId: number;
let shulName: string;

beforeAll(async () => {
  const [shul] = await db
    .insert(shuls)
    .values({
      name: "[TEST] Zichron Yaakov Congregation",
      slug: "test-zichron-yaakov-congregation",
      address: "1 Test St",
      isActive: true,
    })
    .returning();
  shulId = shul.id;
  shulName = shul.name;

  const community = await db
    .insert(communityNewsletters)
    .values([
      {
        title: "[TEST] Week of Aug 3",
        publisher: "[TEST] Israel News Bulletin",
        fileUrl: "https://example.com/aug3.pdf",
        publishedAt: new Date("2026-08-03T12:00:00Z"),
        isActive: true,
      },
      {
        title: "[TEST] Week of Jul 27",
        publisher: "[TEST] Israel News Bulletin",
        fileUrl: "https://example.com/jul27.pdf",
        publishedAt: new Date("2026-07-27T12:00:00Z"),
        isActive: true,
      },
      {
        title: "[TEST] Deactivated Israel News Bulletin issue",
        publisher: "[TEST] Hidden Publisher Bulletin",
        fileUrl: "https://example.com/hidden.pdf",
        publishedAt: new Date("2026-08-10T12:00:00Z"),
        isActive: false,
      },
    ])
    .returning();
  newsletterIds.push(...community.map((r) => r.id));

  const docs = await db
    .insert(shulDocuments)
    .values([
      {
        shulId,
        title: "[TEST] Parshas Devarim",
        type: "newsletter",
        fileUrl: "https://example.com/devarim.pdf",
        publishedAt: new Date("2026-07-17T12:00:00Z"),
        isActive: true,
      },
      {
        shulId,
        title: "[TEST] Zichron Yaakov davening times",
        type: "tefillah",
        fileUrl: "https://example.com/tefillah.pdf",
        isActive: true,
      },
    ])
    .returning();
  shulDocIds.push(...docs.map((r) => r.id));
});

afterAll(async () => {
  if (shulDocIds.length) {
    await db.delete(shulDocuments).where(inArray(shulDocuments.id, shulDocIds));
  }
  if (newsletterIds.length) {
    await db
      .delete(communityNewsletters)
      .where(inArray(communityNewsletters.id, newsletterIds));
  }
  if (shulId) await db.delete(shuls).where(eq(shuls.id, shulId));
});

describe("searchNewsletters", () => {
  it("finds a community series by its publisher name", async () => {
    const results = await searchNewsletters("Israel News Bulletin", 8);

    const hit = results.find((r) => r.title === "[TEST] Israel News Bulletin");
    expect(hit).toBeDefined();
    // Resolves to the series, not /newsletters — landing on the unfiltered
    // page is the exact problem this search exists to fix.
    expect(hit!.url).toBe("/newsletters?publisher=test-israel-news-bulletin");
    expect(hit!.type).toBe("newsletters");
  });

  it("finds a community newsletter by its title", async () => {
    const results = await searchNewsletters("Week of Aug 3", 8);
    expect(results.some((r) => r.url.includes("test-israel-news-bulletin"))).toBe(true);
  });

  it("returns one suggestion per series, not one per issue", async () => {
    // Two active issues share a publisher. Without dedupe both would return,
    // pointing at the same URL — and at perTypeLimit 3 in searchAll, one
    // series would consume the entire newsletter allowance.
    const results = await searchNewsletters("Israel News Bulletin", 8);
    const forSeries = results.filter((r) =>
      r.url.includes("test-israel-news-bulletin")
    );
    expect(forSeries).toHaveLength(1);
  });

  it("finds a shul newsletter by the shul name, slugged from the name", async () => {
    const results = await searchNewsletters("Zichron Yaakov", 8);

    const hit = results.find((r) => r.title === shulName);
    expect(hit).toBeDefined();
    // From the NAME, not shuls.slug — the grouping key on the public page is
    // derived from the name, so a link built on the slug column would land on
    // an empty state.
    expect(hit!.url).toBe("/newsletters?shul=test-zichron-yaakov-congregation");
  });

  it("never returns a tefillah document", async () => {
    const results = await searchNewsletters("davening times", 8);
    expect(results.some((r) => r.subtitle?.includes("davening times"))).toBe(false);
  });

  it("never returns an inactive newsletter", async () => {
    const results = await searchNewsletters("Hidden Publisher Bulletin", 8);
    expect(results.some((r) => r.title.includes("Hidden Publisher"))).toBe(false);
  });

  it("prefixes ids per table so the two tables cannot collide", async () => {
    const results = await searchNewsletters("[TEST]", 20);
    const ids = results.map((r) => r.id);
    expect(ids.every((id) => /^[cs]-\d+$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
