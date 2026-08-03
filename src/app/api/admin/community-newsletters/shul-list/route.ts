import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shulDocuments, shuls } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";

/**
 * Shul newsletters, read-only, so the Community → Newsletters screen can show
 * everything that is actually on the public newsletters page.
 *
 * It lives under `community-newsletters` rather than `/api/admin/newsletters/`
 * on purpose: that directory *is* the email-campaign API, and putting a public
 * -page route there would recreate the naming confusion this work exists to
 * remove.
 *
 * These rows belong to shul managers, who edit them through Shuls → Docs —
 * hence no POST, PATCH or DELETE here.
 */
export const dynamic = "force-dynamic";

/** A few years of weekly issues without an unbounded scan. */
const ROW_LIMIT = 200;

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await db
      .select({
        id: shulDocuments.id,
        title: shulDocuments.title,
        fileUrl: shulDocuments.fileUrl,
        fileSize: shulDocuments.fileSize,
        description: shulDocuments.description,
        publishedAt: shulDocuments.publishedAt,
        shulId: shulDocuments.shulId,
        shulName: shuls.name,
      })
      .from(shulDocuments)
      // innerJoin: shul_id is NOT NULL, and the row is meaningless on this
      // screen without the shul it belongs to.
      .innerJoin(shuls, eq(shulDocuments.shulId, shuls.id))
      .where(
        and(
          // The table also holds tefillah sheets. The nearest precedent,
          // /api/admin/shuls/[id]/documents, returns every type — correct
          // there, wrong here, where the screen mirrors /newsletters.
          eq(shulDocuments.type, "newsletter"),
          eq(shulDocuments.isActive, true)
        )
      )
      .orderBy(desc(shulDocuments.publishedAt), desc(shulDocuments.id))
      .limit(ROW_LIMIT);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("[ADMIN] Error fetching shul newsletters:", error);
    return NextResponse.json(
      { error: "Failed to fetch shul newsletters" },
      { status: 500 }
    );
  }
}
