import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/admin/businesses/non-profit-applications - List pending non-profit applications
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const applications = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        slug: businesses.slug,
        nonProfitDocumentUrl: businesses.nonProfitDocumentUrl,
        nonProfitStatus: businesses.nonProfitStatus,
        createdAt: businesses.createdAt,
      })
      .from(businesses)
      .where(eq(businesses.nonProfitStatus, "pending"));

    return NextResponse.json({ data: applications });
  } catch (error) {
    console.error("[Non-Profit Applications] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch non-profit applications" },
      { status: 500 }
    );
  }
}
