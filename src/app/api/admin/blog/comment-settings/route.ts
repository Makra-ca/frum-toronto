import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  BLOG_COMMENT_MODERATION_KEY,
  MODERATION_VALUES,
  parseModeration,
} from "@/lib/blog/comment-moderation";

/**
 * The site-wide blog comment moderation default.
 *
 * The comment route has read this key since the blog shipped, but nothing
 * could ever write it — there was no admin screen and no row, so every comment
 * fell through to auto-publish with no way to change it.
 */

export const dynamic = "force-dynamic";

const SETTING_DESCRIPTION =
  "Default moderation for blog comments when a post has no override";

const putSchema = z.object({
  moderation: z.enum(MODERATION_VALUES),
});

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [setting] = await db
      .select({ value: siteSettings.value, updatedAt: siteSettings.updatedAt })
      .from(siteSettings)
      .where(eq(siteSettings.key, BLOG_COMMENT_MODERATION_KEY))
      .limit(1);

    return NextResponse.json({
      // parseModeration, not the raw value: the screen must show what the
      // comment route will actually do, including for an absent or bad row.
      moderation: parseModeration(setting?.value),
      // Lets the page say "never set" rather than implying someone chose this.
      isExplicitlySet: setting !== undefined,
      updatedAt: setting?.updatedAt ?? null,
    });
  } catch (error) {
    console.error("[API] Error reading blog comment settings:", error);
    return NextResponse.json(
      { error: "Failed to load comment settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = putSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { moderation } = result.data;

    // Upsert on the unique key. neon-http has no transactions, so this is done
    // as a single statement rather than a read-then-write that could race two
    // admins into a duplicate-key error.
    await db
      .insert(siteSettings)
      .values({
        key: BLOG_COMMENT_MODERATION_KEY,
        value: moderation,
        description: SETTING_DESCRIPTION,
      })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value: moderation, description: SETTING_DESCRIPTION },
      });

    return NextResponse.json({ moderation, isExplicitlySet: true });
  } catch (error) {
    console.error("[API] Error saving blog comment settings:", error);
    return NextResponse.json(
      { error: "Failed to save comment settings" },
      { status: 500 }
    );
  }
}
