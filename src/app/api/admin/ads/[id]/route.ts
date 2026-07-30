import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { homepageAds } from "@/lib/db/schema";
import { updateAdSchema, moderateAdSchema } from "@/lib/validations/ads";
import { normalizeExternalUrl } from "@/lib/safe-url";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return session;
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * PATCH — edit, moderate, move or toggle.
 *
 * Editing rather than delete-and-recreate is deliberate: an advertiser sending
 * replacement artwork should not cost the ad its click history and its record of
 * having been approved.
 *
 * A moderation body (`approvalStatus`) is handled separately from a content
 * edit, so approving an ad cannot accidentally blank a field that was simply
 * absent from the request.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const adId = parseInt(id, 10);
    if (!Number.isInteger(adId) || adId <= 0) {
      return NextResponse.json({ error: "Invalid ad id" }, { status: 400 });
    }

    const body = await request.json();

    // Moderation path.
    if ("approvalStatus" in body) {
      const result = moderateAdSchema.safeParse(body);
      if (!result.success) {
        return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
      }

      const [updated] = await db
        .update(homepageAds)
        .set({
          approvalStatus: result.data.approvalStatus,
          // Clear a previous reason on approval, so an approved ad never carries
          // a stale rejection note.
          rejectionReason:
            result.data.approvalStatus === "rejected"
              ? (result.data.rejectionReason ?? null)
              : null,
          updatedAt: new Date(),
        })
        .where(eq(homepageAds.id, adId))
        .returning();

      if (!updated) return NextResponse.json({ error: "Ad not found" }, { status: 404 });
      return NextResponse.json(updated);
    }

    // Content edit path.
    const result = updateAdSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }
    const data = result.data;

    // Only touch what was actually sent. Building the object from the keys
    // present means a partial edit cannot null out a field it never mentioned.
    const updates: Partial<typeof homepageAds.$inferInsert> = { updatedAt: new Date() };

    if (data.title !== undefined) updates.title = data.title;
    if (data.imageUrl !== undefined) updates.imageUrl = data.imageUrl;
    if (data.placement !== undefined) updates.placement = data.placement;
    if (data.businessId !== undefined) updates.businessId = data.businessId ?? null;
    if (data.isActive !== undefined) updates.isActive = data.isActive;
    if (data.startsAt !== undefined) updates.startsAt = toDate(data.startsAt);
    if (data.endsAt !== undefined) updates.endsAt = toDate(data.endsAt);

    if (data.linkType !== undefined) {
      updates.linkType = data.linkType;
      // The URL must be re-derived whenever the type changes, or switching to
      // 'none' would leave the old link behind and violate the DB constraint the
      // other way round.
      updates.linkUrl =
        data.linkType === "external" ? normalizeExternalUrl(data.linkUrl) : null;
    } else if (data.linkUrl !== undefined) {
      updates.linkUrl = normalizeExternalUrl(data.linkUrl);
    }

    const [updated] = await db
      .update(homepageAds)
      .set(updates)
      .where(eq(homepageAds.id, adId))
      .returning();

    if (!updated) return NextResponse.json({ error: "Ad not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[ADS] Failed to update ad:", error);
    return NextResponse.json({ error: "Failed to update ad" }, { status: 500 });
  }
}

/**
 * DELETE — remove an ad entirely.
 *
 * Switching off hides an ad but keeps it in the list forever, so mistakes and
 * test entries accumulate. Deletion is destructive and loses the click history,
 * which is why the UI confirms first.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const adId = parseInt(id, 10);
    if (!Number.isInteger(adId) || adId <= 0) {
      return NextResponse.json({ error: "Invalid ad id" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(homepageAds)
      .where(eq(homepageAds.id, adId))
      .returning({ id: homepageAds.id });

    if (!deleted) return NextResponse.json({ error: "Ad not found" }, { status: 404 });
    return NextResponse.json({ message: "Ad deleted" });
  } catch (error) {
    console.error("[ADS] Failed to delete ad:", error);
    return NextResponse.json({ error: "Failed to delete ad" }, { status: 500 });
  }
}
