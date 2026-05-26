import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { newsletters, newsletterBlockSettings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET — return all block settings for this newsletter
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

    const settings = await db
      .select()
      .from(newsletterBlockSettings)
      .where(eq(newsletterBlockSettings.newsletterId, newsletterId));

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[BLOCK-SETTINGS] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch block settings" }, { status: 500 });
  }
}

// POST — upsert a single block setting
export async function POST(
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

    const body = await request.json();
    const { blockType, isEnabled, config } = body;

    if (!blockType || typeof blockType !== "string") {
      return NextResponse.json({ error: "blockType is required" }, { status: 400 });
    }

    if (typeof isEnabled !== "boolean") {
      return NextResponse.json({ error: "isEnabled must be a boolean" }, { status: 400 });
    }

    // Upsert: insert or update on conflict (newsletterId, blockType)
    const [upserted] = await db
      .insert(newsletterBlockSettings)
      .values({
        newsletterId,
        blockType,
        isEnabled,
        config: config ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [newsletterBlockSettings.newsletterId, newsletterBlockSettings.blockType],
        set: {
          isEnabled,
          config: config ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({ setting: upserted });
  } catch (error) {
    console.error("[BLOCK-SETTINGS] POST error:", error);
    return NextResponse.json({ error: "Failed to save block setting" }, { status: 500 });
  }
}
