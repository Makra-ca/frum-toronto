import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shuls, businesses } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const denomination = searchParams.get("denomination");
    const nusach = searchParams.get("nusach");

    let query = db
      .select({
        id: shuls.id,
        businessId: shuls.businessId,
        name: businesses.name,
        slug: businesses.slug,
        address: businesses.address,
        phone: businesses.phone,
        email: businesses.email,
        rabbi: shuls.rabbi,
        denomination: shuls.denomination,
        nusach: shuls.nusach,
        hasMinyan: shuls.hasMinyan,
      })
      .from(shuls)
      .innerJoin(businesses, eq(shuls.businessId, businesses.id))
      .$dynamic();

    // Filter by denomination
    if (denomination) {
      query = query.where(eq(shuls.denomination, denomination));
    }

    // Filter by nusach
    if (nusach) {
      query = query.where(eq(shuls.nusach, nusach));
    }

    // Order by name
    query = query.orderBy(asc(businesses.name));

    const results = await query;

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error fetching shuls:", error);
    return NextResponse.json(
      { error: "Failed to fetch shuls" },
      { status: 500 }
    );
  }
}
