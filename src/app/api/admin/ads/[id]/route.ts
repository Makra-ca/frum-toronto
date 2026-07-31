import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { homepageAds } from "@/lib/db/schema";
import { updateAdSchema, moderateAdSchema, adRulesSchema } from "@/lib/validations/ads";
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

    // The stored row is required, not optional: a partial edit's cross-field
    // rules depend on the half that was NOT sent. Validating the body alone let
    // "change only startsAt" through Zod and into a database CHECK violation,
    // surfacing as a 500 where a 400 belongs.
    const [existing] = await db
      .select()
      .from(homepageAds)
      .where(eq(homepageAds.id, adId))
      .limit(1);

    if (!existing) return NextResponse.json({ error: "Ad not found" }, { status: 404 });

    // `undefined` means "not sent, keep it"; an explicit null means "clear it".
    const pick = <T>(sent: T | undefined, stored: T): T =>
      sent === undefined ? stored : sent;

    const linkType = pick(data.linkType, existing.linkType);
    const startsAt = data.startsAt === undefined ? existing.startsAt : toDate(data.startsAt);
    const endsAt = data.endsAt === undefined ? existing.endsAt : toDate(data.endsAt);
    // NOT `pick(data.businessId ?? null, …)` — `?? null` collapses undefined to
    // null before pick can tell them apart, which would clear the business on
    // every edit. The same shape as the Zod-default bug this rewrite fixes.
    const businessId =
      data.businessId === undefined ? existing.businessId : (data.businessId ?? null);

    // Re-derive the URL from the RESOLVED link type, so switching to 'none'
    // clears a stale link and switching to 'external' keeps the stored one when
    // no new URL was sent.
    const linkUrl =
      linkType === "external"
        ? normalizeExternalUrl(data.linkUrl === undefined ? existing.linkUrl : data.linkUrl)
        : null;

    const merged = { linkType, linkUrl, businessId, startsAt, endsAt };
    const rules = adRulesSchema.safeParse(merged);
    if (!rules.success) {
      return NextResponse.json({ error: rules.error.issues[0].message }, { status: 400 });
    }

    const [updated] = await db
      .update(homepageAds)
      .set({
        title: pick(data.title, existing.title),
        imageUrl: pick(data.imageUrl, existing.imageUrl),
        placement: pick(data.placement, existing.placement),
        isActive: pick(data.isActive, existing.isActive),
        ...merged,
        updatedAt: new Date(),
      })
      .where(eq(homepageAds.id, adId))
      .returning();

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
