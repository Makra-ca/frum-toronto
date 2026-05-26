"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface EruvStatusRow {
  id: number;
  statusDate: string;
  isUp: boolean;
  message: string | null;
  updatedAt: string | null;
  updatedBy: number | null;
}

export function EruvWidget() {
  const [data, setData] = useState<EruvStatusRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/community/eruv")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((json) => {
        setData(json.status === null ? null : (json as EruvStatusRow));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <div className="p-1 rounded-full bg-gray-100">
                <div className="h-5 w-5 rounded-full bg-gray-200 animate-pulse" />
              </div>
              Eruv Status
            </span>
            <div className="h-5 w-10 rounded bg-gray-200 animate-pulse" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-4 rounded bg-gray-200 animate-pulse w-3/4" />
          <div className="h-3 rounded bg-gray-200 animate-pulse w-1/2" />
          <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-md">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Always verify eruv status before Shabbos. Call the eruv hotline for real-time updates.
            </p>
          </div>
          <div className="h-8 rounded bg-gray-100 animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <div className="p-1 rounded-full bg-gray-100">
                <AlertCircle className="h-5 w-5 text-gray-400" />
              </div>
              Eruv Status
            </span>
            <Badge variant="secondary">Unavailable</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-400">Status information is currently unavailable.</p>
          <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-md">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Always verify eruv status before Shabbos. Call the eruv hotline for real-time updates.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/eruv">Eruv Information</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const StatusIcon = data.isUp ? CheckCircle2 : XCircle;
  const statusColor = data.isUp ? "text-green-600" : "text-red-600";
  const statusBg = data.isUp ? "bg-green-50" : "bg-red-50";
  const statusText = data.isUp ? "UP" : "DOWN";

  const formattedDate = new Date(data.statusDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedUpdatedAt = data.updatedAt
    ? new Date(data.updatedAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

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
            variant={data.isUp ? "default" : "destructive"}
            className={data.isUp ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
          >
            {statusText}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm font-medium text-gray-700">{formattedDate}</p>

        {data.message && data.message.trim() && (
          <p className="text-sm text-gray-600">{data.message}</p>
        )}

        {formattedUpdatedAt && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="h-3 w-3" />
            <span>Updated: {formattedUpdatedAt}</span>
          </div>
        )}

        <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-md">
          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Always verify eruv status before Shabbos. Call the eruv hotline for real-time updates.
          </p>
        </div>

        <Button asChild variant="ghost" size="sm" className="w-full">
          <Link href="/eruv">Eruv Information</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
