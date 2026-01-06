import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shuls, daveningSchedules, events } from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// GET public shul details by slug
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;

    // Get shul by slug
    const [shul] = await db
      .select()
      .from(shuls)
      .where(and(eq(shuls.slug, slug), eq(shuls.isActive, true)))
      .limit(1);

    if (!shul) {
      return NextResponse.json({ error: "Shul not found" }, { status: 404 });
    }

    // Get davening schedules
    const schedules = await db
      .select()
      .from(daveningSchedules)
      .where(eq(daveningSchedules.shulId, shul.id));

    // Get upcoming events for this shul
    const upcomingEvents = await db
      .select()
      .from(events)
      .where(
        and(
          eq(events.shulId, shul.id),
          eq(events.isActive, true),
          gte(events.startTime, new Date())
        )
      )
      .orderBy(events.startTime)
      .limit(10);

    return NextResponse.json({
      ...shul,
      daveningSchedules: schedules,
      events: upcomingEvents,
    });
  } catch (error) {
    console.error("Failed to fetch shul:", error);
    return NextResponse.json(
      { error: "Failed to fetch shul" },
      { status: 500 }
    );
  }
}
