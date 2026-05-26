import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { importantNumbers } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET - Public list of all important numbers
export async function GET() {
  try {
    const numbers = await db
      .select()
      .from(importantNumbers)
      .orderBy(asc(importantNumbers.displayOrder), asc(importantNumbers.name));

    return NextResponse.json({ numbers });
  } catch (error) {
    console.error("[API] Error fetching important numbers:", error);
    return NextResponse.json(
      { error: "Failed to fetch important numbers" },
      { status: 500 }
    );
  }
}
