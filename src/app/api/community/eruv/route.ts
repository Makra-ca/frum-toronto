import { NextResponse } from "next/server";
import { getCurrentEruvStatus } from "@/lib/eruv/current-status";

export const dynamic = "force-dynamic";

/**
 * The eruv status for the Shabbos currently in effect.
 *
 * `status` is looked up by exact date, so a status entered for an earlier
 * Shabbos can never be returned as the current one — the staleness problem is
 * structural rather than something to tune with a cutoff.
 *
 * `status` is null for most of the week: the eruv is generally not confirmed
 * until Friday, so Sunday through Thursday there is genuinely nothing yet. That
 * is the normal state, not an error.
 *
 * `previous` is the most recent status STRICTLY BEFORE this Shabbos, offered as
 * dated context for those quiet days. It is a separate field and never merged
 * into `status`, so no consumer can render a past result as current.
 *
 * The query lives in @/lib/eruv/current-status so this route and the /eruv page
 * cannot drift apart on what counts as current.
 */
export async function GET() {
  try {
    return NextResponse.json(await getCurrentEruvStatus());
  } catch (error) {
    console.error("[API] Error fetching eruv status:", error);
    return NextResponse.json({ error: "Failed to fetch eruv status" }, { status: 500 });
  }
}
