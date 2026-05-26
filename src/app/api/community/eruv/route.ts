import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eruvStatus } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [latest] = await db
      .select()
      .from(eruvStatus)
      .orderBy(desc(eruvStatus.statusDate))
      .limit(1);

    if (!latest) {
      return NextResponse.json({ status: null });
    }

    return NextResponse.json(latest);
  } catch (error) {
    console.error("[API] Error fetching eruv status:", error);
    return NextResponse.json({ error: "Failed to fetch eruv status" }, { status: 500 });
  }
}
