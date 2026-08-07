import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { inArray, eq } from "drizzle-orm";
import { z } from "zod";
import {
  COMMENT_SURFACES,
  COMMENT_SURFACE_KEYS,
  MODERATION_VALUES,
  parseModeration,
  type CommentSurface,
} from "@/lib/comments/moderation";

/**
 * Site-wide comment moderation defaults, one per surface.
 *
 * The blog key has been READ since the blog shipped but nothing could ever
 * write it — no admin screen, no row — so every comment fell through to
 * auto-publish. Ask the Rabbi had no site-wide layer at all.
 *
 * One endpoint for both, rather than one per surface: adding a third surface
 * later should not mean a third route, and the screen wants them together.
 */

export const dynamic = "force-dynamic";

const putSchema = z.object({
  surface: z.enum(COMMENT_SURFACE_KEYS as [CommentSurface, ...CommentSurface[]]),
  moderation: z.enum(MODERATION_VALUES),
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const keys = COMMENT_SURFACE_KEYS.map((s) => COMMENT_SURFACES[s].key);
    const rows = await db
      .select({
        key: siteSettings.key,
        value: siteSettings.value,
        updatedAt: siteSettings.updatedAt,
      })
      .from(siteSettings)
      .where(inArray(siteSettings.key, keys));

    const byKey = new Map(rows.map((r) => [r.key, r]));

    return NextResponse.json({
      surfaces: COMMENT_SURFACE_KEYS.map((surface) => {
        const config = COMMENT_SURFACES[surface];
        const row = byKey.get(config.key);
        return {
          surface,
          label: config.label,
          hasPerItemOverride: config.hasPerItemOverride,
          // parseModeration, not the raw value: the screen must show what the
          // comment routes will actually do, including for an absent or bad row.
          moderation: parseModeration(row?.value),
          // Lets the page say "never set" rather than implying someone chose it.
          isExplicitlySet: row !== undefined,
          updatedAt: row?.updatedAt ?? null,
        };
      }),
    });
  } catch (error) {
    console.error("[API] Error reading comment settings:", error);
    return NextResponse.json(
      { error: "Failed to load comment settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const result = putSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { surface, moderation } = result.data;
    const config = COMMENT_SURFACES[surface];

    // Upsert on the unique key. neon-http has no transactions, so this is one
    // statement rather than a read-then-write that could race two admins into
    // a duplicate-key error.
    await db
      .insert(siteSettings)
      .values({
        key: config.key,
        value: moderation,
        description: config.description,
      })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value: moderation, description: config.description },
      });

    const [row] = await db
      .select({ updatedAt: siteSettings.updatedAt })
      .from(siteSettings)
      .where(eq(siteSettings.key, config.key))
      .limit(1);

    return NextResponse.json({
      surface,
      moderation,
      isExplicitlySet: true,
      updatedAt: row?.updatedAt ?? null,
    });
  } catch (error) {
    console.error("[API] Error saving comment settings:", error);
    return NextResponse.json(
      { error: "Failed to save comment settings" },
      { status: 500 }
    );
  }
}
