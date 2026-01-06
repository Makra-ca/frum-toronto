import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { daveningSchedules, shuls } from "@/lib/db/schema";
import { eq, asc, and } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const day = searchParams.get("day");
    const tefilahType = searchParams.get("type");
    const shulId = searchParams.get("shulId");

    // Build conditions
    const conditions = [eq(shuls.isActive, true)];

    if (day) {
      conditions.push(eq(daveningSchedules.dayOfWeek, parseInt(day)));
    }

    if (tefilahType) {
      conditions.push(eq(daveningSchedules.tefilahType, tefilahType));
    }

    if (shulId) {
      conditions.push(eq(daveningSchedules.shulId, parseInt(shulId)));
    }

    const results = await db
      .select({
        id: daveningSchedules.id,
        shulId: daveningSchedules.shulId,
        shulName: shuls.name,
        shulSlug: shuls.slug,
        shulAddress: shuls.address,
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
      .where(and(...conditions))
      .orderBy(asc(daveningSchedules.time));

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error fetching davening schedules:", error);
    return NextResponse.json(
      { error: "Failed to fetch davening schedules" },
      { status: 500 }
    );
  }
}
