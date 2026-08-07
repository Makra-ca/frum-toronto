import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { eruvStatus } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { isShabbosDate, listUpcomingShabbatot } from "@/lib/eruv/shabbos";

/** How many Shabbatot the admin can choose from. ~3 months of runway. */
const SELECTABLE_SHABBATOT = 12;

// GET - List recent 30 eruv statuses
export async function GET() {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const statuses = await db
      .select()
      .from(eruvStatus)
      .orderBy(desc(eruvStatus.statusDate))
      .limit(30);

    // Computed here rather than in the client so hebcal stays out of the admin
    // bundle, and so the options can never disagree with the server's own
    // notion of which Shabbos is current.
    const shabbatot = listUpcomingShabbatot(new Date(), SELECTABLE_SHABBATOT);

    return NextResponse.json({ statuses, shabbatot });
  } catch (error) {
    console.error("[API] Error fetching eruv statuses:", error);
    return NextResponse.json({ error: "Failed to fetch eruv statuses" }, { status: 500 });
  }
}

// POST - Create or upsert eruv status
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { statusDate, isUp, message } = body;

    if (!statusDate) {
      return NextResponse.json({ error: "Status date is required" }, { status: 400 });
    }

    // A status is looked up by the Shabbos it applies to, so one stored against
    // any other day could never be found — and would fail silently.
    if (typeof statusDate !== "string" || !isShabbosDate(statusDate)) {
      return NextResponse.json(
        { error: "Status date must be a Saturday (YYYY-MM-DD)" },
        { status: 400 },
      );
    }

    if (typeof isUp !== "boolean") {
      return NextResponse.json({ error: "isUp must be a boolean" }, { status: 400 });
    }

    const [entry] = await db
      .insert(eruvStatus)
      .values({
        statusDate,
        isUp,
        message: message?.trim() || null,
        updatedBy: parseInt(session.user.id),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: eruvStatus.statusDate,
        set: {
          isUp,
          message: message?.trim() || null,
          updatedBy: parseInt(session.user.id),
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("[API] Error saving eruv status:", error);
    return NextResponse.json({ error: "Failed to save eruv status" }, { status: 500 });
  }
}
