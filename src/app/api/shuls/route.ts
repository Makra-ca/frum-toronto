import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shuls } from "@/lib/db/schema";
import { eq, asc, and } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const denomination = searchParams.get("denomination");
    const nusach = searchParams.get("nusach");

    // Build conditions array
    const conditions = [eq(shuls.isActive, true)];

    if (denomination) {
      conditions.push(eq(shuls.denomination, denomination));
    }

    if (nusach) {
      conditions.push(eq(shuls.nusach, nusach));
    }

    const results = await db
      .select()
      .from(shuls)
      .where(and(...conditions))
      .orderBy(asc(shuls.name));

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error fetching shuls:", error);
    return NextResponse.json(
      { error: "Failed to fetch shuls" },
      { status: 500 }
    );
  }
}
