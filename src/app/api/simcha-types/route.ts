import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { simchaTypes } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const types = await db
      .select()
      .from(simchaTypes)
      .orderBy(simchaTypes.displayOrder);

    return NextResponse.json(types);
  } catch (error) {
    console.error("[API] Error fetching simcha types:", error);
    return NextResponse.json({ error: "Failed to fetch types" }, { status: 500 });
  }
}
