import { Metadata } from "next";
import { MapPin, History } from "lucide-react";
import { EruvStatusPanel } from "@/components/eruv/EruvStatusPanel";
import {
  getCurrentEruvStatus,
  getRecentEruvStatuses,
} from "@/lib/eruv/current-status";
import { formatDateOnly } from "@/lib/datetime";

export const metadata: Metadata = {
  title: "Eruv Status | FrumToronto",
  description:
    "Current eruv status for Toronto's Orthodox Jewish community, updated for each Shabbos.",
};

// Admin-managed content that changes weekly; never serve a build-time snapshot.
export const dynamic = "force-dynamic";

/** How many past Shabbatot the history list shows. */
const HISTORY_LIMIT = 10;

export default async function EruvPage() {
  const [current, recent] = await Promise.all([
    getCurrentEruvStatus(),
    getRecentEruvStatuses(HISTORY_LIMIT),
  ]);

  // The current Shabbos already has its own panel above the list.
  const history = recent.filter((row) => row.statusDate !== current.shabbosDate);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 py-12 text-white">
        <div className="container mx-auto px-4">
          <div className="mb-3 flex items-center gap-3">
            <MapPin className="h-8 w-8" />
            <h1 className="text-3xl font-bold md:text-4xl">Eruv Status</h1>
          </div>
          <p className="max-w-2xl text-blue-200">
            The status of the Toronto eruv for each Shabbos, as reported to
            FrumToronto.
          </p>
        </div>
      </div>

      <div className="container mx-auto max-w-3xl space-y-10 px-4 py-10">
        <EruvStatusPanel
          shabbosDate={current.shabbosDate}
          status={current.status}
          previous={current.previous}
        />

        {history.length > 0 && (
          <section>
            <div className="mb-4 flex items-center gap-2">
              <History className="h-5 w-5 text-gray-500" />
              <h2 className="text-xl font-bold text-gray-900">
                Previous Shabbosos
              </h2>
            </div>

            <div className="divide-y overflow-hidden rounded-xl border bg-white shadow-sm">
              {history.map((row) => (
                <div
                  key={row.id}
                  className="flex items-start justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">
                      {formatDateOnly(row.statusDate, {
                        weekday: "short",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    {row.message?.trim() && (
                      <p className="mt-1 text-sm text-gray-500">{row.message}</p>
                    )}
                  </div>
                  <span
                    className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                      row.isUp
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {row.isUp ? "UP" : "DOWN"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
