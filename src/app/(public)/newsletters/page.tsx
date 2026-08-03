import { db } from "@/lib/db";
import { shulDocuments, shuls, communityNewsletters } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Newspaper, FileText, Download, Building2, Info } from "lucide-react";
import { formatInstant } from "@/lib/datetime";
import {
  groupSeries,
  selectSeries,
  shouldGroup,
  flattenSeries,
  byPublisher,
  byShul,
  type Series,
  type Row as NewsletterRow,
} from "@/lib/newsletters/group-series";

export const metadata = {
  title: "Newsletters - FrumToronto",
  description:
    "Community and shul newsletters for Toronto's Jewish community — all in one place.",
};

export const dynamic = "force-dynamic";

/** A few years of weekly issues, without an unbounded scan. */
const ROW_LIMIT = 200;
const CARD_GRID = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4";

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "";
  return formatInstant(date, { month: "short", day: "numeric", year: "numeric" });
}

async function getCommunityNewsletters() {
  return db
    .select()
    .from(communityNewsletters)
    .where(eq(communityNewsletters.isActive, true))
    // desc() emits no NULLS LAST and Postgres sorts NULLs first, so an undated
    // row leads here. Harmless: groupSeries re-sorts and the limit is generous.
    // Tighten ROW_LIMIT and this needs NULLS LAST.
    .orderBy(desc(communityNewsletters.publishedAt), desc(communityNewsletters.id))
    .limit(ROW_LIMIT);
}

async function getShulNewsletters() {
  return db
    .select({
      id: shulDocuments.id,
      title: shulDocuments.title,
      fileUrl: shulDocuments.fileUrl,
      fileSize: shulDocuments.fileSize,
      description: shulDocuments.description,
      publishedAt: shulDocuments.publishedAt,
      // Selected, not merely filtered on — groupSeries reads it off the row.
      isActive: shulDocuments.isActive,
      shulName: shuls.name,
      shulSlug: shuls.slug,
    })
    .from(shulDocuments)
    .leftJoin(shuls, eq(shulDocuments.shulId, shuls.id))
    .where(
      and(eq(shulDocuments.type, "newsletter"), eq(shulDocuments.isActive, true))
    )
    .orderBy(desc(shulDocuments.publishedAt), desc(shulDocuments.id))
    .limit(ROW_LIMIT);
}

type CommunityRow = Awaited<ReturnType<typeof getCommunityNewsletters>>[number];
type ShulRow = Awaited<ReturnType<typeof getShulNewsletters>>[number];

interface CardRow {
  title: string;
  fileUrl: string;
  fileSize: number | null;
  description: string | null;
  publishedAt: Date | null;
}

function NewsletterCard({
  row,
  subtitle,
  accent,
}: {
  row: CardRow;
  subtitle?: React.ReactNode;
  accent: "blue" | "indigo";
}) {
  const icon =
    accent === "blue"
      ? "bg-blue-100 text-blue-600"
      : "bg-indigo-100 text-indigo-600";
  return (
    <a href={row.fileUrl} target="_blank" rel="noopener noreferrer" className="block group">
      <Card className="h-full hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${icon}`}>
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900 group-hover:text-blue-700 transition-colors line-clamp-2">
                {row.title}
              </p>
              {subtitle}
              {row.description && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{row.description}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                <Download className="h-3 w-3" />
                <span>
                  {formatDate(row.publishedAt)}
                  {row.fileSize ? ` · ${formatFileSize(row.fileSize)}` : ""}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </a>
  );
}

/**
 * One named series: the latest issue, with the back catalogue behind a
 * <details>. Deliberately <details> rather than React state — this page is a
 * Server Component, and a native disclosure needs no JavaScript, is keyboard
 * accessible, and keeps the links in the DOM for search engines.
 */
function SeriesBlock<T extends CardRow & NewsletterRow>({
  series,
  seeAllHref,
  renderCard,
  showHeading = true,
}: {
  series: Series<T>;
  seeAllHref: string;
  renderCard: (row: T) => React.ReactNode;
  /** False on a filtered view, where the page's own <h1> already names it. */
  showHeading?: boolean;
}) {
  return (
    <div className="space-y-3">
      {showHeading && (
        <h3 className="text-lg font-semibold text-gray-800">{series.name}</h3>
      )}
      <div className={CARD_GRID}>{renderCard(series.latest)}</div>

      {series.past.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-blue-700 hover:underline">
            Past issues ({series.past.length}
            {series.hasMore ? "+" : ""})
          </summary>
          <div className={`${CARD_GRID} mt-3`}>{series.past.map(renderCard)}</div>
          {series.hasMore && (
            <Link href={seeAllHref} className="inline-block mt-3 text-sm text-blue-700 hover:underline">
              See all issues →
            </Link>
          )}
        </details>
      )}
    </div>
  );
}

export default async function NewslettersPage({
  searchParams,
}: {
  // Next 16: this is a Promise. Reading a property without awaiting yields
  // undefined, and the filter would silently never apply.
  searchParams: Promise<{ publisher?: string; shul?: string }>;
}) {
  const params = await searchParams;
  // A blank param is no filter. If both are somehow present publisher wins,
  // rather than applying both and rendering nothing.
  const publisherFilter = params.publisher?.trim() || undefined;
  const shulFilter = publisherFilter ? undefined : params.shul?.trim() || undefined;
  const isFiltered = Boolean(publisherFilter || shulFilter);

  const [community, shulNewsletters] = await Promise.all([
    getCommunityNewsletters(),
    getShulNewsletters(),
  ]);

  // A filtered view is uncapped, or "See all issues" links to a page applying
  // the same cap and the older issues stay unreachable.
  const opts = isFiltered ? { pastLimit: Number.POSITIVE_INFINITY } : undefined;

  const communitySeries = selectSeries(
    groupSeries<CommunityRow>(community, byPublisher, opts),
    publisherFilter
  );
  const shulSeries = selectSeries(
    groupSeries<ShulRow>(shulNewsletters, byShul, opts),
    shulFilter
  );

  // Gated on the FILTERED series, not the raw rows — otherwise an unknown slug
  // renders a bare heading over a full list of the other kind.
  const showCommunity = communitySeries.length > 0 && !shulFilter;
  const showShul = shulSeries.length > 0 && !publisherFilter;
  const nothingToShow = !showCommunity && !showShul;

  // From the side actually being filtered. A blank param is no filter, so the
  // OTHER side is still the full list — reading whichever is non-empty headed
  // ?shul=ahavat-shalom with the name of an unrelated community series, and
  // headed a not-found page with the name of a series it had not matched.
  const seriesName = publisherFilter
    ? communitySeries[0]?.name
    : shulFilter
      ? shulSeries[0]?.name
      : undefined;

  const communityCard = (n: CommunityRow) => (
    <NewsletterCard
      key={`c-${n.id}`}
      row={n}
      accent="blue"
      subtitle={
        n.publisher && !isFiltered ? (
          <p className="text-xs text-gray-500 mt-0.5">{n.publisher}</p>
        ) : undefined
      }
    />
  );

  const shulCard = (n: ShulRow) => (
    <NewsletterCard
      key={`s-${n.id}`}
      row={n}
      accent="indigo"
      subtitle={
        n.shulName && !isFiltered ? (
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            {n.shulName}
          </p>
        ) : undefined
      }
    />
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-3">
            <Newspaper className="h-8 w-8" />
            <h1 className="text-3xl md:text-4xl font-bold">
              {isFiltered && seriesName ? seriesName : "Newsletters"}
            </h1>
          </div>
          <p className="text-blue-200 max-w-2xl">
            {isFiltered && seriesName
              ? "Every issue, newest first."
              : "Community and shul newsletters, all in one place — no need to visit each shul."}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-10">
        {nothingToShow && (
          <Card>
            <CardContent className="py-12 text-center">
              <Info className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {isFiltered ? "No newsletters here" : "No Newsletters Yet"}
              </h3>
              <p className="text-gray-500 mb-4">
                {isFiltered
                  ? "We couldn't find that newsletter — it may have been renamed."
                  : "Check back soon for community and shul newsletters."}
              </p>
              {isFiltered && (
                <Link href="/newsletters" className="text-blue-700 hover:underline">
                  See all newsletters →
                </Link>
              )}
            </CardContent>
          </Card>
        )}

        {showCommunity && (
          <section>
            {!isFiltered && (
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Community Newsletters
              </h2>
            )}
            {/* Headings only once a series has a back catalogue — a handful of
                one-off PDFs would otherwise become a stack of lone headings. */}
            {shouldGroup(communitySeries) ? (
              <div className="space-y-8">
                {communitySeries.map((s) => (
                  <SeriesBlock
                    key={s.slug}
                    series={s}
                    seeAllHref={`/newsletters?publisher=${s.slug}`}
                    renderCard={communityCard}
                    showHeading={!isFiltered}
                  />
                ))}
              </div>
            ) : (
              // Every issue, not one per series — series.latest here drops
              // the back catalogue of any series that has one, and a flat
              // grid gives the reader no sign anything is missing.
              <div className={CARD_GRID}>
                {flattenSeries(communitySeries).map(communityCard)}
              </div>
            )}
          </section>
        )}

        {showShul && (
          <section>
            {!isFiltered && (
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Shul Newsletters
              </h2>
            )}
            {shouldGroup(shulSeries) ? (
              <div className="space-y-8">
                {shulSeries.map((s) => (
                  <SeriesBlock
                    key={s.slug}
                    series={s}
                    seeAllHref={`/newsletters?shul=${s.slug}`}
                    renderCard={shulCard}
                    showHeading={!isFiltered}
                  />
                ))}
              </div>
            ) : (
              <div className={CARD_GRID}>
                {flattenSeries(shulSeries).map(shulCard)}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
