import { formatDateOnly, formatInstant } from "@/lib/datetime";
import { APPROVAL_STATUSES } from "@/lib/submissions/statuses";

/**
 * How a submission's state reads to the person who submitted it.
 *
 * Deliberately not the database words. "pending_edit" means nothing to a
 * user; "Awaiting re-approval" tells them their correction is in a queue and
 * their item is off the site until someone looks.
 *
 * Kept out of the page so it can be tested without a DOM, and so the test can
 * be driven from APPROVAL_STATUSES — adding a status then forces a style
 * rather than falling through to a grey badge showing the raw column value.
 */
export interface StatusStyle {
  label: string;
  className: string;
  /** Left-edge stripe, so state is scannable without reading the label. */
  stripe: string;
}

export const STATUS_STYLES: Record<string, StatusStyle> = {
  approved: {
    label: "Live",
    className: "bg-green-100 text-green-800 hover:bg-green-100",
    stripe: "bg-green-500",
  },
  pending: {
    label: "Awaiting approval",
    className: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    stripe: "bg-amber-500",
  },
  pending_edit: {
    label: "Awaiting re-approval",
    className: "bg-amber-100 text-amber-900 hover:bg-amber-100",
    stripe: "bg-amber-600",
  },
  rejected: {
    label: "Not approved",
    className: "bg-red-100 text-red-800 hover:bg-red-100",
    stripe: "bg-red-500",
  },
};

export const FALLBACK_STATUS_STYLE: StatusStyle = {
  label: "Unknown",
  className: "bg-gray-100 text-gray-700",
  stripe: "bg-gray-400",
};

export function statusStyle(status: string): StatusStyle {
  return STATUS_STYLES[status] ?? FALLBACK_STATUS_STYLE;
}

/** Every status the system uses has a style. */
export const STYLED_STATUSES = APPROVAL_STATUSES;

/**
 * Renders a submission's `detail` using the formatter its column type requires.
 *
 * A `date` column must NOT go through formatInstant: it holds a calendar day
 * with no timezone, and converting it shifts it back a day for any viewer west
 * of the stored value's implied zone. This is the branch that keeps simchas and
 * shiva notices showing the day they actually are.
 */
export function formatSubmissionDetail(
  detail: string | null,
  kind: "instant" | "date"
): string | null {
  if (!detail) return null;

  if (kind === "date") {
    return formatDateOnly(detail, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return formatInstant(detail, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
