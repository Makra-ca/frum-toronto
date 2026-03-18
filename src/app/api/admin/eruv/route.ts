import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { eruvStatus } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

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

    return NextResponse.json({ statuses });
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
