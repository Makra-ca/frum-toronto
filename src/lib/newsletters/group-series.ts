/**
 * Turning a flat list of newsletters into named, linkable series.
 *
 * Three readers wrote in asking where "Israel News" had gone. It had not gone
 * anywhere — it was one card in a date-sorted pile with no heading carrying its
 * name and no URL pointing at it. This module produces the series so the answer
 * can be a link.
 *
 * Deliberately pure: no database, no React. The rules below are each a real
 * bug if missed, and keeping them here means they are unit-tested cheaply and
 * cannot drift between the public page and the filtered view.
 */

/** Rows with no grouping key collect under this slug. */
export const OTHER_SLUG = "other";

/**
 * Shared by publisher names and shul names — the same rules apply to both, so
 * a link keeps working whether someone types `israel-news` or `Israel News`.
 */
export function seriesSlug(key: string | null | undefined): string {
  const trimmed = (key ?? "").trim().toLowerCase();
  if (!trimmed) return OTHER_SLUG;
  return (
    trimmed.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || OTHER_SLUG
  );
}

export interface Row {
  id: number;
  title: string;
  fileUrl: string;
  publishedAt: Date | null;
  isActive: boolean | null;
  /** Community newsletters group on this. */
  publisher?: string | null;
  /** Shul newsletters group on this. */
  shulName?: string | null;
}

/**
 * What a row is grouped by. Community newsletters use publisher, shul
 * newsletters use the shul name — same rules, different key.
 */
export type SeriesKey<T extends Row = Row> = (row: T) => string | null | undefined;

export const byPublisher: SeriesKey = (r) => r.publisher;
export const byShul: SeriesKey = (r) => r.shulName;

/**
 * Generic in T so the CALLER's row type survives. The cards render fileSize,
 * description and shulSlug; handing back a bare `Row` would drop them and the
 * page would not compile. Widening `Row` instead would put shul-specific
 * columns into a module that is meant to be key-agnostic.
 */
export interface Series<T extends Row = Row> {
  /** Display name, taken from the newest issue. */
  name: string;
  slug: string;
  latest: T;
  past: T[];
  /** True when `past` was truncated — drives the "see all" link. */
  hasMore: boolean;
}

const DEFAULT_PAST_LIMIT = 12;

/** Newest first. Undated sorts last; ties break on id so paging is stable. */
function byNewest(a: Row, b: Row): number {
  const at = a.publishedAt?.getTime() ?? -Infinity;
  const bt = b.publishedAt?.getTime() ?? -Infinity;
  if (at !== bt) return bt - at;
  return b.id - a.id;
}

export function groupSeries<T extends Row>(
  rows: T[],
  keyOf: SeriesKey<T>,
  opts: { pastLimit?: number } = {}
): Series<T>[] {
  const pastLimit = opts.pastLimit ?? DEFAULT_PAST_LIMIT;

  const bySlug = new Map<string, T[]>();
  for (const r of rows) {
    // `isActive` is nullable and defaults to true, so only an explicit false
    // hides a row — matching the public query's `eq(isActive, true)` for real
    // data while not silently dropping legacy nulls.
    if (r.isActive === false) continue;
    const slug = seriesSlug(keyOf(r));
    const group = bySlug.get(slug);
    if (group) group.push(r);
    else bySlug.set(slug, [r]);
  }

  const series: Series<T>[] = [];
  for (const [slug, group] of bySlug) {
    group.sort(byNewest);
    const [latest, ...rest] = group;
    series.push({
      name: (keyOf(latest) ?? "").trim() || "Other",
      slug,
      latest,
      past: rest.slice(0, pastLimit),
      hasMore: rest.length > pastLimit,
    });
  }

  // "Other" always last: one ad-hoc PDF must not push Israel News below the
  // fold. Only one OTHER key can exist, so the 1/-1 arms stay antisymmetric
  // and this remains a consistent total order.
  return series.sort((a, b) => {
    if (a.slug === OTHER_SLUG) return 1;
    if (b.slug === OTHER_SLUG) return -1;
    return byNewest(a.latest, b.latest);
  });
}

/**
 * One series by slug, for the shareable link.
 *
 * A falsy slug means no filter. An unknown slug returns an empty array, which
 * the page renders as "no such series, here is the full list" — never a 404,
 * because these URLs go into emails and outlive a publisher being renamed.
 */
export function selectSeries<T extends Row>(
  series: Series<T>[],
  slug: string | undefined | null
): Series<T>[] {
  if (!slug || !slug.trim()) return series;
  const wanted = seriesSlug(slug);
  return series.filter((s) => s.slug === wanted);
}

/**
 * Whether grouping earns its place yet.
 *
 * On today's data the shul side is one shul with two newsletters and four with
 * one each — grouping that turns a tidy card grid into five headings, four of
 * them a lone card. Callers fall back to a flat grid until at least one series
 * actually has a back catalogue.
 */
export function shouldGroup<T extends Row>(series: Series<T>[]): boolean {
  return series.some((s) => s.past.length > 0);
}
