import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { daveningSchedules, shuls, businesses } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const day = searchParams.get("day");
    const tefilahType = searchParams.get("type");
    const shulId = searchParams.get("shulId");

    let query = db
      .select({
        id: daveningSchedules.id,
        shulId: daveningSchedules.shulId,
        shulName: businesses.name,
        shulAddress: businesses.address,
        tefilahType: daveningSchedules.tefilahType,
        dayOfWeek: daveningSchedules.dayOfWeek,
        time: daveningSchedules.time,
        notes: daveningSchedules.notes,
        isWinter: daveningSchedules.isWinter,
        isSummer: daveningSchedules.isSummer,
        isShabbos: daveningSchedules.isShabbos,
        rabbi: shuls.rabbi,
        denomination: shuls.denomination,
        nusach: shuls.nusach,
      })
      .from(daveningSchedules)
      .innerJoin(shuls, eq(daveningSchedules.shulId, shuls.id))
      .innerJoin(businesses, eq(shuls.businessId, businesses.id))
      .$dynamic();

    // Filter by day of week
    if (day) {
      query = query.where(eq(daveningSchedules.dayOfWeek, parseInt(day)));
    }

    // Filter by tefilah type
    if (tefilahType) {
      query = query.where(eq(daveningSchedules.tefilahType, tefilahType));
    }

    // Filter by specific shul
    if (shulId) {
      query = query.where(eq(daveningSchedules.shulId, parseInt(shulId)));
    }

    // Order by time
    query = query.orderBy(asc(daveningSchedules.time));

    const results = await query;

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error fetching davening schedules:", error);
    return NextResponse.json(
      { error: "Failed to fetch davening schedules" },
      { status: 500 }
    );
  }
}
