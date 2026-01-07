import { db } from "@/lib/db";
import { alerts } from "@/lib/db/schema";
import { desc, eq, and, or, isNull, gte } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertTriangle, Info, Pin } from "lucide-react";

export const metadata = {
  title: "Alerts & Bulletins - FrumToronto",
  description: "Community alerts and bulletins for the Toronto Jewish community",
};

export const revalidate = 60; // Cache for 1 minute

async function getAlerts() {
  const now = new Date();

  const alertsList = await db
    .select()
    .from(alerts)
    .where(
      and(
        eq(alerts.isActive, true),
        or(
          isNull(alerts.expiresAt),
          gte(alerts.expiresAt, now)
        )
      )
    )
    .orderBy(desc(alerts.isPinned), desc(alerts.createdAt));

  return alertsList;
}

export default async function AlertsPage() {
  const alertsList = await getAlerts();

  const getUrgencyBadge = (urgency: string | null) => {
    switch (urgency) {
      case "urgent":
        return <Badge className="bg-red-100 text-red-800">Urgent</Badge>;
      case "important":
        return <Badge className="bg-orange-100 text-orange-800">Important</Badge>;
      default:
        return null;
    }
  };

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case "bulletin":
        return <Bell className="h-5 w-5" />;
      case "kosher":
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="h-8 w-8" />
            <h1 className="text-3xl md:text-4xl font-bold">Alerts & Bulletins</h1>
          </div>
          <p className="text-blue-200 max-w-2xl">
            Stay informed about community announcements, important updates, and bulletins
            for the Toronto Jewish community.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {alertsList.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Info className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Active Alerts
              </h3>
              <p className="text-gray-500">
                There are currently no alerts or bulletins to display.
                Check back later for updates.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {alertsList.map((alert) => (
              <Card
                key={alert.id}
                className={`${
                  alert.isPinned ? "border-l-4 border-l-blue-500 bg-blue-50/50" : ""
                } ${
                  alert.urgency === "urgent" ? "border-l-4 border-l-red-500" : ""
                }`}
              >
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="text-gray-500">
                        {getAlertIcon(alert.alertType)}
                      </div>
                      <div>
                        <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
                          {alert.isPinned && (
                            <Pin className="h-4 w-4 text-blue-600" />
                          )}
                          {alert.title}
                        </CardTitle>
                        <p className="text-sm text-gray-500 mt-1 capitalize">
                          {alert.alertType}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {getUrgencyBadge(alert.urgency)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div
                    className="text-gray-700 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: alert.content }}
                  />
                  <div className="mt-4 text-sm text-gray-500">
                    Posted: {alert.createdAt ? new Date(alert.createdAt).toLocaleDateString() : "Unknown"}
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
