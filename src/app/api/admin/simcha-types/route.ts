import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { simchaTypes } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

// GET - List all simcha types
export async function GET() {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const types = await db
      .select()
      .from(simchaTypes)
      .orderBy(asc(simchaTypes.displayOrder), asc(simchaTypes.name));

    return NextResponse.json(types);
  } catch (error) {
    console.error("[API] Error fetching simcha types:", error);
    return NextResponse.json({ error: "Failed to fetch types" }, { status: 500 });
  }
}
