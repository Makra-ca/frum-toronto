import { db } from "@/lib/db";
import { kosherAlerts } from "@/lib/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info, Calendar, Package } from "lucide-react";
import { KosherAlertSubmitModal } from "@/components/kosher-alerts/KosherAlertSubmitModal";

export const metadata = {
  title: "Kosher Alerts - FrumToronto",
  description: "Stay informed about kosher product recalls and status changes in the Toronto Jewish community",
};

export const dynamic = "force-dynamic"; // Fresh data always

async function getKosherAlerts() {
  const alerts = await db
    .select()
    .from(kosherAlerts)
    .where(
      and(
        eq(kosherAlerts.isActive, true),
        eq(kosherAlerts.approvalStatus, "approved")
      )
    )
    .orderBy(desc(kosherAlerts.createdAt));

  return alerts;
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

export default async function KosherAlertsPage() {
  const alerts = await getKosherAlerts();

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
                No Active Alerts
              </h3>
              <p className="text-gray-500 mb-4">
                There are currently no kosher alerts to display.
                Check back later for updates.
              </p>
              <p className="text-sm text-gray-400">
                Know of a kosher concern? Use the &quot;Report Kosher Alert&quot; button above
                to submit information for review.
              </p>
            </CardContent>
          </Card>
        ) : (
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
