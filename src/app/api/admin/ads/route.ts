import { NextRequest, NextResponse } from "next/server";
import { eq, desc, asc } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { homepageAds, businesses } from "@/lib/db/schema";
import { createAdSchema } from "@/lib/validations/ads";
import { normalizeExternalUrl } from "@/lib/safe-url";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return session;
}

/** Empty string from a form field means "not set", not an invalid date. */
function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * GET — every ad, for the admin list.
 *
 * Deliberately unpaginated and unfiltered by status: the whole point of the page
 * is to see everything at once, including expired and rejected ads, and the
 * count is bounded by how many ads a person has hand-created. Ordered oldest-
 * placement-first within each position so the list does not reshuffle between
 * loads (the PUBLIC ordering is random; the admin's must not be).
 */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ads = await db
      .select({
        id: homepageAds.id,
        title: homepageAds.title,
        imageUrl: homepageAds.imageUrl,
        placement: homepageAds.placement,
        linkType: homepageAds.linkType,
        linkUrl: homepageAds.linkUrl,
        businessId: homepageAds.businessId,
        businessName: businesses.name,
        businessSlug: businesses.slug,
        approvalStatus: homepageAds.approvalStatus,
        rejectionReason: homepageAds.rejectionReason,
        startsAt: homepageAds.startsAt,
        endsAt: homepageAds.endsAt,
        isActive: homepageAds.isActive,
        clickCount: homepageAds.clickCount,
        createdAt: homepageAds.createdAt,
      })
      .from(homepageAds)
      .leftJoin(businesses, eq(homepageAds.businessId, businesses.id))
      // id breaks ties: bulk-created rows share a created_at to the millisecond,
      // and without it the list order is not stable between loads.
      .orderBy(asc(homepageAds.placement), desc(homepageAds.createdAt), desc(homepageAds.id));

    return NextResponse.json({ ads });
  } catch (error) {
    console.error("[ADS] Failed to list ads:", error);
    return NextResponse.json({ error: "Failed to load ads" }, { status: 500 });
  }
}

/**
 * POST — create an ad.
 *
 * Admin-created ads are approved on insert. The `pending` default on the column
 * exists for business submissions, where approval is the whole point; an admin
 * placing an ad by hand has already made that decision.
 */
export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = createAdSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }
    const data = result.data;

    // Store the normalised form, so the scheme people leave off is added once
    // here rather than being re-derived at every render site.
    const linkUrl = data.linkType === "external" ? normalizeExternalUrl(data.linkUrl) : null;

    const [ad] = await db
      .insert(homepageAds)
      .values({
        title: data.title,
        imageUrl: data.imageUrl,
        placement: data.placement,
        linkType: data.linkType,
        linkUrl,
        // Kept regardless of link type: business_id records WHOSE ad this is,
        // which is not the same question as where it points. A paid business ad
        // may well link to an external campaign page.
        businessId: data.businessId ?? null,
        submittedBy: parseInt(session.user.id),
        approvalStatus: "approved",
        startsAt: toDate(data.startsAt),
        endsAt: toDate(data.endsAt),
        isActive: data.isActive ?? true,
      })
      .returning();

    return NextResponse.json(ad, { status: 201 });
  } catch (error) {
    console.error("[ADS] Failed to create ad:", error);
    return NextResponse.json({ error: "Failed to create ad" }, { status: 500 });
  }
}
