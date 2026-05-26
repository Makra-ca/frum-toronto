import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/events/organizations?q=<term>
// Returns distinct organization names matching the search term (public autocomplete)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");

    if (!q || q.trim().length < 2) {
      return NextResponse.json({ organizations: [] });
    }

    const searchTerm = `%${q.trim()}%`;

    const results = await db
      .selectDistinct({ organization: events.organization })
      .from(events)
      .where(
        sql`${events.organization} ILIKE ${searchTerm} AND ${events.organization} IS NOT NULL AND ${events.organization} != ''`
      )
      .orderBy(events.organization)
      .limit(10);

    const organizations = results
      .map((r) => r.organization)
      .filter((o): o is string => o !== null && o !== "");

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error("[EVENTS] Error fetching organizations:", error);
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 }
    );
  }
}
