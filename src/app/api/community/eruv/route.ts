import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eruvStatus } from "@/lib/db/schema";
import { desc, eq, lt } from "drizzle-orm";
import { currentShabbos } from "@/lib/eruv/shabbos";

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
 */
export async function GET() {
  try {
    const shabbosDate = currentShabbos();

    const [status] = await db
      .select()
      .from(eruvStatus)
      .where(eq(eruvStatus.statusDate, shabbosDate))
      .limit(1);

    const [previous] = await db
      .select()
      .from(eruvStatus)
      .where(lt(eruvStatus.statusDate, shabbosDate))
      .orderBy(desc(eruvStatus.statusDate))
      .limit(1);

    return NextResponse.json({
      shabbosDate,
      status: status ?? null,
      previous: previous ?? null,
    });
  } catch (error) {
    console.error("[API] Error fetching eruv status:", error);
    return NextResponse.json({ error: "Failed to fetch eruv status" }, { status: 500 });
  }
}
