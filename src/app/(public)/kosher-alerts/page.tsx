import { db } from "@/lib/db";
import { kosherAlerts } from "@/lib/db/schema";
import { desc, eq, and, sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info, Calendar, Package } from "lucide-react";
import { KosherAlertSubmitModal } from "@/components/kosher-alerts/KosherAlertSubmitModal";
import Link from "next/link";
import { PaginationLinks } from "@/components/ui/PaginationLinks";

export const metadata = {
  title: "Kosher Alerts - FrumToronto",
  description: "Stay informed about kosher product recalls and status changes in the Toronto Jewish community",
};

export const dynamic = "force-dynamic"; // Fresh data always

const PAGE_SIZE = 25;

async function getKosherAlerts(page: number) {
  const whereClause = and(
    eq(kosherAlerts.isActive, true),
    eq(kosherAlerts.approvalStatus, "approved")
  );

  // The archive holds ~1,600 alerts imported from the legacy site. This page is
  // force-dynamic, so without a LIMIT every request fetched and rendered all of
  // them — measured at 46s once the legacy import landed.
  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(kosherAlerts)
      .where(whereClause)
      // id breaks ties: many legacy alerts share a created_at, and without a
      // stable tiebreaker OFFSET paging can repeat or skip rows.
      .orderBy(desc(kosherAlerts.createdAt), desc(kosherAlerts.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ count: sql<number>`count(*)` })
      .from(kosherAlerts)
      .where(whereClause),
  ]);

  return { items: rows, totalCount: Number(countRows[0]?.count ?? 0) };
}

/** Parses ?page= defensively: junk, 0 and negatives all fall back to page 1. */
function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function getAlertTypeBadge(type: string | null) {
  switch (type) {
    case "recall":
      return <Badge variant="destructive">Recall</Badge>;
    case "status_change":
      return <Badge className="bg-yellow-100 text-yellow-800">Status Change</Badge>;
    case "warning":
      return <Badge className="bg-orange-100 text-orange-800">Warning</Badge>;
    case "update":
      return <Badge className="bg-blue-100 text-blue-800">Update</Badge>;
    default:
      return null;
  }
}

function getAlertBorderColor(type: string | null) {
  switch (type) {
    case "recall":
      return "border-l-red-500";
    case "warning":
      return "border-l-orange-500";
    case "status_change":
      return "border-l-yellow-500";
    default:
      return "border-l-blue-500";
  }
}

export default async function KosherAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const requestedPage = parsePage(pageParam);
  const { items: alerts, totalCount } = await getKosherAlerts(requestedPage);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const firstShown = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(currentPage * PAGE_SIZE, totalCount);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-red-900 via-red-800 to-red-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="h-8 w-8" />
                <h1 className="text-3xl md:text-4xl font-bold">Kosher Alerts</h1>
              </div>
              <p className="text-red-200 max-w-2xl">
                Stay informed about kosher product recalls, status changes, and important
                updates from kashrus agencies. Community members can submit alerts for review.
              </p>
            </div>
            <div className="flex-shrink-0">
              <KosherAlertSubmitModal />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {alerts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Info className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {totalCount > 0 ? "That page doesn't exist" : "No Active Alerts"}
              </h3>
              <p className="text-gray-500 mb-4">
                {totalCount > 0 ? (
                  <>
                    There are only {totalPages} {totalPages === 1 ? "page" : "pages"} of alerts.{" "}
                    <Link href="/kosher-alerts" className="text-red-700 hover:underline">
                      Back to the first page
                    </Link>
                  </>
                ) : (
                  "There are currently no kosher alerts to display. Check back later for updates."
                )}
              </p>
              <p className="text-sm text-gray-400">
                Know of a kosher concern? Use the &quot;Report Kosher Alert&quot; button above
                to submit information for review.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-6">
              Showing {firstShown.toLocaleString()}&ndash;{lastShown.toLocaleString()} of{" "}
              {totalCount.toLocaleString()} alert{totalCount === 1 ? "" : "s"}
            </p>
            <div className="space-y-4">
            {alerts.map((alert) => (
              <Card key={alert.id} className={`border-l-4 ${getAlertBorderColor(alert.alertType)}`}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg text-gray-900">
                        {alert.productName}
                      </CardTitle>
                      {alert.brand && (
                        <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                          <Package className="h-4 w-4" />
                          {alert.brand}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {getAlertTypeBadge(alert.alertType)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-4 whitespace-pre-wrap">{alert.description}</p>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                    {alert.certifyingAgency && (
                      <span>Agency: {alert.certifyingAgency}</span>
                    )}
                    {alert.effectiveDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Effective: {new Date(alert.effectiveDate).toLocaleDateString()}
                      </span>
                    )}
                    {alert.createdAt && (
                      <span>
                        Posted: {new Date(alert.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            </div>

            <PaginationLinks
              basePath="/kosher-alerts"
              currentPage={currentPage}
              totalPages={totalPages}
            />
          </>
        )}

        {/* Disclaimer */}
        <div className="mt-8 p-4 bg-gray-100 rounded-lg text-sm text-gray-600">
          <p className="font-medium mb-2">Disclaimer</p>
          <p>
            The information on this page is provided as a community service and may not be complete
            or current. Always consult your Rabbi and the relevant kashrus agency for authoritative
            guidance on kosher matters.
          </p>
        </div>
      </div>
    </div>
  );
}
