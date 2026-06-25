import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shulNeighborhoods } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET - public list of active neighborhoods (for filter + form dropdowns)
export async function GET() {
  try {
    const rows = await db
      .select({ id: shulNeighborhoods.id, name: shulNeighborhoods.name })
      .from(shulNeighborhoods)
      .where(eq(shulNeighborhoods.isActive, true))
      .orderBy(asc(shulNeighborhoods.displayOrder), asc(shulNeighborhoods.name));
    return NextResponse.json(rows);
  } catch (error) {
    console.error("[API] Error fetching shul neighborhoods:", error);
    return NextResponse.json({ error: "Failed to fetch neighborhoods" }, { status: 500 });
  }
}
