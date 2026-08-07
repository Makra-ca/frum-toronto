import { db } from "@/lib/db";
import { simchas, simchaTypes } from "@/lib/db/schema";
import { simchaBrowseOrder } from "@/lib/simchas/ordering";
import { eq, and, sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PartyPopper, Calendar, MapPin, Info } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SimchaSubmitModal } from "@/components/simchas/SimchaSubmitModal";
import { PaginationLinks } from "@/components/ui/PaginationLinks";
import { SimchasSearchBar } from "@/components/simchas/SimchasSearchBar";
import { buildSubstringCondition } from "@/lib/search/substring-search";
import { formatDateOnly } from "@/lib/datetime";

export const metadata = {
  title: "Simchas - FrumToronto",
  description: "Celebrate simchas with the Toronto Jewish community - mazal tovs, engagements, weddings, and more",
};

export const revalidate = 300; // Cache for 5 minutes

// Divisible by both 2 and 3 so the last row of the responsive grid is never ragged.
const PAGE_SIZE = 24;

async function getSimchas(typeSlug: string | undefined, page: number, search: string) {
  const conditions = [
    eq(simchas.isActive, true),
    eq(simchas.approvalStatus, "approved"),
  ];
  if (typeSlug) {
    conditions.push(eq(simchaTypes.slug, typeSlug));
  }

  // Every term must match the family name or the announcement body, so a query
  // naming two families ("Guttman Jenah") still finds the notice.
  const searchCondition = buildSubstringCondition(
    [simchas.familyName, simchas.announcement],
    search
  );
  if (searchCondition) conditions.push(searchCondition);

  const whereClause = and(...conditions);

  // The archive holds ~16.5k announcements imported from the legacy site, so
  // both the page window and the count have to be pushed down to Postgres —
  // this page used to select every row and render all of them.
  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: simchas.id,
        familyName: simchas.familyName,
        announcement: simchas.announcement,
        eventDate: simchas.eventDate,
        location: simchas.location,
        photoUrl: simchas.photoUrl,
        createdAt: simchas.createdAt,
        typeName: simchaTypes.name,
        typeSlug: simchaTypes.slug,
      })
      .from(simchas)
      .leftJoin(simchaTypes, eq(simchas.typeId, simchaTypes.id))
      .where(whereClause)
      .orderBy(...simchaBrowseOrder)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ count: sql<number>`count(*)` })
      .from(simchas)
      .leftJoin(simchaTypes, eq(simchas.typeId, simchaTypes.id))
      .where(whereClause),
  ]);

  return {
    items: rows,
    totalCount: Number(countRows[0]?.count ?? 0),
  };
}

/**
 * Count per simcha type, honouring the active search but NOT the active type —
 * so the pills show how many results each type *would* give, which is what makes
 * them worth reading rather than just clicking blindly.
 */
async function getTypeCounts(search: string) {
  const conditions = [
    eq(simchas.isActive, true),
    eq(simchas.approvalStatus, "approved"),
  ];
  const searchCondition = buildSubstringCondition(
    [simchas.familyName, simchas.announcement],
    search
  );
  if (searchCondition) conditions.push(searchCondition);

  const rows = await db
    .select({ slug: simchaTypes.slug, count: sql<number>`count(*)` })
    .from(simchas)
    .leftJoin(simchaTypes, eq(simchas.typeId, simchaTypes.id))
    .where(and(...conditions))
    .groupBy(simchaTypes.slug);

  const bySlug = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    const n = Number(r.count);
    total += n;
    if (r.slug) bySlug.set(r.slug, n);
  }
  return { bySlug, total };
}

async function getSimchaTypes() {
  const types = await db
    .select()
    .from(simchaTypes)
    .orderBy(simchaTypes.displayOrder);

  return types;
}

/** Parses ?page= defensively: junk, 0 and negatives all fall back to page 1. */
function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export default async function SimchasPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string; search?: string }>;
}) {
  const { type: activeType, page: pageParam, search: searchParam } = await searchParams;
  const requestedPage = parsePage(pageParam);
  const search = (searchParam ?? "").trim();

  const [{ items: simchasList, totalCount }, types, typeCounts] = await Promise.all([
    getSimchas(activeType, requestedPage, search),
    getSimchaTypes(),
    getTypeCounts(search),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  // A page number past the end returns no rows; report the clamped value so the
  // pagination control still highlights a real page.
  const currentPage = Math.min(requestedPage, totalPages);
  const firstShown = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(currentPage * PAGE_SIZE, totalCount);
  const isFiltered = search !== "" || Boolean(activeType);

  /** Builds a /simchas URL keeping whichever of type/search still applies. */
  const hrefFor = (opts: { type?: string; search?: string }) => {
    const params = new URLSearchParams();
    if (opts.type) params.set("type", opts.type);
    if (opts.search) params.set("search", opts.search);
    const qs = params.toString();
    return qs ? `/simchas?${qs}` : "/simchas";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <PartyPopper className="h-8 w-8" />
                <h1 className="text-3xl md:text-4xl font-bold">Simchas</h1>
              </div>
              <p className="text-purple-200 max-w-2xl">
                Celebrate with the Toronto Jewish community! Share in the joy of
                engagements, weddings, births, bar/bat mitzvahs, and other simchas.
              </p>
            </div>
            <SimchaSubmitModal />
          </div>

          {/* Search matters more than paging here: the archive runs to ~16,550
              announcements going back to 2005, so nobody finds a family by
              clicking through hundreds of pages. */}
          <div className="mt-6">
            <SimchasSearchBar initialQuery={search} />
          </div>
        </div>
      </div>

      {/* Quick filters */}
      {types.length > 0 && (
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { slug: undefined, name: "All", count: typeCounts.total },
              ...types.map((t) => ({
                slug: t.slug,
                name: t.name,
                count: typeCounts.bySlug.get(t.slug) ?? 0,
              })),
            ].map((chip) => {
              const isActive = chip.slug
                ? activeType === chip.slug
                : !activeType;
              // Empty types stay visible but are visibly inert, so the set of
              // categories does not shift around as the search changes.
              const isEmpty = chip.count === 0 && !isActive;

              return (
                <Link
                  key={chip.slug ?? "all"}
                  href={hrefFor({ type: chip.slug, search })}
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-purple-600 bg-purple-600 text-white shadow-sm hover:bg-purple-700"
                      : isEmpty
                        ? "border-gray-200 bg-white text-gray-400 hover:bg-gray-50"
                        : "border-gray-300 bg-white text-gray-700 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-900"
                  }`}
                >
                  {chip.name}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                      isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {chip.count.toLocaleString()}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {simchasList.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Info className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {totalCount > 0
                  ? "That page doesn't exist"
                  : search
                    ? `No simchas match \u201C${search}\u201D`
                    : activeType
                      ? "No simchas of this type yet"
                      : "No Simchas Posted"}
              </h3>
              <p className="text-gray-500">
                {totalCount > 0 ? (
                  <>
                    There {totalCount === 1 ? "is" : "are"} only {totalPages}{" "}
                    {totalPages === 1 ? "page" : "pages"} of results.{" "}
                    <Link
                      href={hrefFor({ type: activeType, search })}
                      className="text-purple-600 hover:underline"
                    >
                      Back to the first page
                    </Link>
                  </>
                ) : search ? (
                  <>
                    Try part of a family name, or{" "}
                    <Link
                      href={hrefFor({ type: activeType })}
                      className="text-purple-600 hover:underline"
                    >
                      clear the search
                    </Link>
                    {activeType ? " — this type filter is still applied." : "."}
                  </>
                ) : activeType ? (
                  <>
                    There are no simchas in this category right now.{" "}
                    <Link href="/simchas" className="text-purple-600 hover:underline">
                      View all simchas
                    </Link>
                  </>
                ) : (
                  "There are currently no simchas to display. Check back later to celebrate with our community!"
                )}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-6">
              Showing {firstShown.toLocaleString()}&ndash;{lastShown.toLocaleString()} of{" "}
              {totalCount.toLocaleString()} simcha{totalCount === 1 ? "" : "s"}
              {search && <> matching &ldquo;{search}&rdquo;</>}
              {isFiltered && (
                <>
                  {" "}
                  &middot;{" "}
                  <Link href="/simchas" className="text-purple-600 hover:underline">
                    clear filters
                  </Link>
                </>
              )}
            </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {simchasList.map((simcha) => (
              <Link
                key={simcha.id}
                href={`/simchas/${simcha.id}`}
                className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 rounded-xl"
              >
              <Card className="h-full overflow-hidden hover:shadow-lg transition-shadow">
                {simcha.photoUrl && (
                  <div className="relative h-48 bg-gray-100">
                    <Image
                      src={simcha.photoUrl}
                      alt={simcha.familyName}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg text-gray-900">
                      {simcha.familyName}
                    </CardTitle>
                    {simcha.typeName && (
                      <Badge className="bg-purple-100 text-purple-800">
                        {simcha.typeName}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-4 line-clamp-3">
                    {simcha.announcement}
                  </p>
                  <div className="space-y-2 text-sm text-gray-500">
                    {simcha.eventDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {formatDateOnly(simcha.eventDate, { month: "numeric", day: "numeric", year: "numeric" })}
                      </div>
                    )}
                    {simcha.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {simcha.location}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              </Link>
            ))}
            </div>

            <PaginationLinks
              basePath="/simchas"
              currentPage={currentPage}
              totalPages={totalPages}
              preserveParams={{ type: activeType, search: search || undefined }}
            />
          </>
        )}
      </div>
    </div>
  );
}
