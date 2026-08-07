import { CheckCircle2, XCircle, HelpCircle, Clock, AlertCircle } from "lucide-react";
import { formatDateOnly, formatInstant } from "@/lib/datetime";
import type { EruvStatusRow } from "@/lib/eruv/current-status";

interface EruvStatusPanelProps {
  /** The Shabbos in effect, "YYYY-MM-DD". */
  shabbosDate: string;
  /** Its status, or null when it has not been checked yet. */
  status: EruvStatusRow | null;
  /** The last known status before it, shown as dated context. */
  previous: EruvStatusRow | null;
}

/**
 * The eruv status for the Shabbos currently in effect.
 *
 * Three states, and the EMPTY one is the common case: the eruv is generally not
 * confirmed until Friday, so Sunday through Thursday there is nothing to show.
 *
 * "Not yet checked" is rendered distinctly from DOWN. They imply the same
 * caution but are different claims, and showing absence as a red DOWN would be
 * a false statement about the eruv.
 *
 * Dates come from a DATE column and go through `formatDateOnly`, which does no
 * timezone conversion. `formatInstant` is for `updatedAt`, which is a real
 * moment. Mixing the two renders a date a day early.
 */
export function EruvStatusPanel({ shabbosDate, status, previous }: EruvStatusPanelProps) {
  const shabbosLabel = formatDateOnly(shabbosDate, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {status ? (
        <KnownStatus status={status} shabbosLabel={shabbosLabel} />
      ) : (
        <NotYetChecked shabbosLabel={shabbosLabel} previous={previous} />
      )}

      <div className="flex items-start gap-2 border-t bg-amber-50 px-6 py-4">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
        <p className="text-sm text-amber-900">
          Always verify the eruv status before Shabbos.
        </p>
      </div>
    </div>
  );
}

function KnownStatus({
  status,
  shabbosLabel,
}: {
  status: EruvStatusRow;
  shabbosLabel: string;
}) {
  const Icon = status.isUp ? CheckCircle2 : XCircle;

  return (
    <div className={`px-6 py-8 ${status.isUp ? "bg-green-50" : "bg-red-50"}`}>
      <div className="flex items-center gap-4">
        <Icon
          className={`h-12 w-12 flex-shrink-0 ${
            status.isUp ? "text-green-600" : "text-red-600"
          }`}
        />
        <div className="min-w-0">
          <p
            className={`text-4xl font-bold leading-none ${
              status.isUp ? "text-green-700" : "text-red-700"
            }`}
          >
            {status.isUp ? "UP" : "DOWN"}
          </p>
          <p className="mt-2 text-sm font-medium text-gray-700">
            for Shabbos, {shabbosLabel}
          </p>
        </div>
      </div>

      {status.message?.trim() && (
        <p className="mt-5 text-gray-700">{status.message}</p>
      )}

      {status.updatedAt && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="h-3 w-3" />
          Updated{" "}
          {formatInstant(status.updatedAt, {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      )}
    </div>
  );
}

function NotYetChecked({
  shabbosLabel,
  previous,
}: {
  shabbosLabel: string;
  previous: EruvStatusRow | null;
}) {
  return (
    <div className="bg-gray-50 px-6 py-8">
      <div className="flex items-center gap-4">
        <HelpCircle className="h-12 w-12 flex-shrink-0 text-gray-400" />
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-tight text-gray-700">
            Not yet checked
          </p>
          <p className="mt-2 text-sm font-medium text-gray-600">
            for Shabbos, {shabbosLabel}
          </p>
        </div>
      </div>

      <p className="mt-5 text-sm text-gray-600">
        The eruv status is usually confirmed on Friday. Check back then.
      </p>

      {previous && (
        <div className="mt-5 border-t pt-4">
          {/* Always dated, so it cannot be mistaken for the current status. */}
          <p className="text-sm text-gray-600">
            Last checked{" "}
            <span className="font-medium text-gray-800">
              {formatDateOnly(previous.statusDate, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            , when the eruv was{" "}
            <span
              className={`font-semibold ${
                previous.isUp ? "text-green-700" : "text-red-700"
              }`}
            >
              {previous.isUp ? "up" : "down"}
            </span>
            .
          </p>
        </div>
      )}
    </div>
  );
}
