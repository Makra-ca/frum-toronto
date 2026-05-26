import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { emailSubscribers, newsletters } from "@/lib/db/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const newsletterId = parseInt(id);
    if (isNaN(newsletterId)) {
      return NextResponse.json({ error: "Invalid newsletter ID" }, { status: 400 });
    }

    // Verify newsletter exists
    const [newsletter] = await db
      .select({ id: newsletters.id })
      .from(newsletters)
      .where(eq(newsletters.id, newsletterId))
      .limit(1);

    if (!newsletter) {
      return NextResponse.json({ error: "Newsletter not found" }, { status: 404 });
    }

    // Count subscribers: newsletter=true AND userId IS NOT NULL AND active AND not unsubscribed
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(emailSubscribers)
      .where(
        and(
          eq(emailSubscribers.newsletter, true),
          isNotNull(emailSubscribers.userId),
          eq(emailSubscribers.isActive, true),
          sql`${emailSubscribers.unsubscribedAt} IS NULL`
        )
      );

    const count = Number(result?.count ?? 0);

    return NextResponse.json({ count });
  } catch (error) {
    console.error("[RECIPIENT-COUNT] Error:", error);
    return NextResponse.json({ error: "Failed to get recipient count" }, { status: 500 });
  }
}
