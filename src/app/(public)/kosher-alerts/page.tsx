import { db } from "@/lib/db";
import { kosherAlerts } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info, Calendar } from "lucide-react";

export const metadata = {
  title: "Kosher Alerts - FrumToronto",
  description: "Stay informed about kosher product recalls and status changes in the Toronto Jewish community",
};

export const revalidate = 300; // Cache for 5 minutes

async function getKosherAlerts() {
  const alerts = await db
    .select()
    .from(kosherAlerts)
    .where(eq(kosherAlerts.isActive, true))
    .orderBy(desc(kosherAlerts.createdAt));

  return alerts;
}

export default async function KosherAlertsPage() {
  const alerts = await getKosherAlerts();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-red-900 via-red-800 to-red-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-8 w-8" />
            <h1 className="text-3xl md:text-4xl font-bold">Kosher Alerts</h1>
          </div>
          <p className="text-red-200 max-w-2xl">
            Stay informed about kosher product recalls, status changes, and important
            updates from kashrus agencies.
          </p>
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
              <p className="text-gray-500">
                There are currently no kosher alerts to display.
                Check back later for updates.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => (
              <Card key={alert.id} className="border-l-4 border-l-red-500">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg text-gray-900">
                        {alert.productName}
                      </CardTitle>
                      {alert.brand && (
                        <p className="text-sm text-gray-500 mt-1">
                          Brand: {alert.brand}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {alert.alertType && (
                        <Badge
                          variant={alert.alertType === "recall" ? "destructive" : "secondary"}
                        >
                          {alert.alertType === "recall" ? "Recall" : "Status Change"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-4">{alert.description}</p>
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
      </div>
    </div>
  );
}
