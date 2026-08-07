"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, Clock, HelpCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatInstant, formatDateOnly } from "@/lib/datetime";

interface EruvStatusRow {
  id: number;
  statusDate: string;
  isUp: boolean;
  message: string | null;
  updatedAt: string | null;
  updatedBy: number | null;
}

interface CurrentEruvStatus {
  shabbosDate: string;
  status: EruvStatusRow | null;
  previous: EruvStatusRow | null;
}

const CAUTION =
  "Always verify eruv status before Shabbos. Call the eruv hotline for real-time updates.";

/**
 * Eruv status for the Shabbos currently in effect.
 *
 * `status` is null for most of the week — the eruv is generally not confirmed
 * until Friday — so the empty state is the common one and must read as "not in
 * yet", not as a site fault and not as DOWN. "Unavailable" is reserved for a
 * genuine fetch failure.
 */
export function EruvWidget() {
  const [data, setData] = useState<CurrentEruvStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/community/eruv")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((json: CurrentEruvStatus) => setData(json))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingCard />;
  if (error || !data) return <UnavailableCard />;

  const { shabbosDate, status, previous } = data;
  const shabbosLabel = formatDateOnly(shabbosDate, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <div
              className={`p-1 rounded-full ${
                status ? (status.isUp ? "bg-green-50" : "bg-red-50") : "bg-gray-100"
              }`}
            >
              {status ? (
                status.isUp ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )
              ) : (
                <HelpCircle className="h-5 w-5 text-gray-400" />
              )}
            </div>
            Eruv Status
          </span>
          {status ? (
            <Badge
              variant={status.isUp ? "default" : "destructive"}
              className={
                status.isUp ? "bg-green-100 text-green-800 hover:bg-green-100" : ""
              }
            >
              {status.isUp ? "UP" : "DOWN"}
            </Badge>
          ) : (
            <Badge variant="secondary">Not yet checked</Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Always dated. An undated UP is what made a stale status dangerous. */}
        <p className="text-sm font-medium text-gray-700">
          for Shabbos, {shabbosLabel}
        </p>

        {status ? (
          <>
            {status.message?.trim() && (
              <p className="text-sm text-gray-600">{status.message}</p>
            )}
            {status.updatedAt && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="h-3 w-3" />
                <span>
                  Updated{" "}
                  {formatInstant(status.updatedAt, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600">Usually confirmed on Friday.</p>
            {previous && (
              <p className="text-xs text-gray-500">
                Last checked{" "}
                {formatDateOnly(previous.statusDate, {
                  month: "long",
                  day: "numeric",
                })}
                , when the eruv was {previous.isUp ? "up" : "down"}.
              </p>
            )}
          </>
        )}

        <Caution />
        <EruvLink />
      </CardContent>
    </Card>
  );
}

function Caution() {
  return (
    <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-md">
      <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800">{CAUTION}</p>
    </div>
  );
}

function EruvLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="w-full">
      <Link href="/eruv">Eruv Information</Link>
    </Button>
  );
}

function LoadingCard() {
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
        <Caution />
        <div className="h-8 rounded bg-gray-100 animate-pulse" />
      </CardContent>
    </Card>
  );
}

/** A genuine failure to reach the API — NOT "no status entered yet". */
function UnavailableCard() {
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
        <p className="text-sm text-gray-400">
          Status information is currently unavailable.
        </p>
        <Caution />
        <EruvLink />
      </CardContent>
    </Card>
  );
}
