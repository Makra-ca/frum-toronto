"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Placeholder data - will be replaced with real data from database
const eruvStatus = {
  isUp: true,
  message: "The eruv is up and in good condition this Shabbos.",
  lastUpdated: "Friday, Dec 13, 2024 at 2:30 PM",
  updatedBy: "Eruv Committee",
};

export function EruvWidget() {
  const StatusIcon = eruvStatus.isUp ? CheckCircle2 : XCircle;
  const statusColor = eruvStatus.isUp ? "text-green-600" : "text-red-600";
  const statusBg = eruvStatus.isUp ? "bg-green-50" : "bg-red-50";
  const statusText = eruvStatus.isUp ? "UP" : "DOWN";
  const badgeVariant = eruvStatus.isUp ? "default" : "destructive";

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <div className={`p-1 rounded-full ${statusBg}`}>
              <StatusIcon className={`h-5 w-5 ${statusColor}`} />
            </div>
            Eruv Status
          </span>
          <Badge
            variant={badgeVariant}
            className={
              eruvStatus.isUp
                ? "bg-green-100 text-green-800 hover:bg-green-100"
                : ""
            }
          >
            {statusText}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-600">{eruvStatus.message}</p>

        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Clock className="h-3 w-3" />
          <span>Updated: {eruvStatus.lastUpdated}</span>
        </div>

        <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-md">
          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Always verify eruv status before Shabbos. Call the eruv hotline for
            real-time updates.
          </p>
        </div>

        <Button asChild variant="ghost" size="sm" className="w-full">
          <Link href="/eruv">Eruv Information</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
