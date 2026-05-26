import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { businesses, shuls } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [businessResult, shulResult] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(businesses)
        .where(and(eq(businesses.approvalStatus, "approved"), eq(businesses.isActive, true))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(shuls)
        .where(eq(shuls.isActive, true)),
    ]);

    return NextResponse.json({
      businesses: Number(businessResult[0]?.count ?? 0),
      shuls: Number(shulResult[0]?.count ?? 0),
    });
  } catch (error) {
    console.error("[Stats API] Error fetching counts:", error);
    return NextResponse.json({ businesses: 0, shuls: 0 }, { status: 500 });
  }
}
