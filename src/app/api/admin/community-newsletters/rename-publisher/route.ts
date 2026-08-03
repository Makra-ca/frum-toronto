import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { communityNewsletters } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

/**
 * Rename a publisher across every issue of its series.
 *
 * `publisher` is free text and it is the grouping key, so a typo splits a
 * series in two: the archive halves, and a link already sent to readers
 * quietly shows a subset with no way for them to tell. The dropdown on the
 * form makes typing a new name deliberate; this makes a typo that does land
 * fixable in one action rather than issue by issue.
 *
 * Matching is EXACT. "Israel News" and "Israeli News" may be two real
 * publications, and silently merging them on similarity is worse than leaving
 * them split — wrong data rather than incomplete data, and far harder to spot.
 * The admin names both sides.
 */
const renameSchema = z.object({
  from: z.string().trim().min(1, "Current publisher is required").max(200),
  to: z.string().trim().min(1, "New publisher name is required").max(200),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = renameSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { from, to } = result.data;

    const updated = await db
      .update(communityNewsletters)
      .set({ publisher: to })
      .where(eq(communityNewsletters.publisher, from))
      .returning({ id: communityNewsletters.id });

    // 0 is a valid outcome, not an error — but it is returned so the caller can
    // say "nothing matched" rather than reporting a rename that did nothing.
    return NextResponse.json({ updated: updated.length, from, to });
  } catch (error) {
    console.error("[API] Error renaming publisher:", error);
    return NextResponse.json(
      { error: "Failed to rename publisher" },
      { status: 500 }
    );
  }
}
