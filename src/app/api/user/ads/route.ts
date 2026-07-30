import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { homepageAds, businesses, subscriptionPlans } from "@/lib/db/schema";
import { normalizeExternalUrl, isSafeExternalUrl } from "@/lib/safe-url";
import { assertCanPost } from "@/lib/auth/require-verified";
import { notifyAdminOfSubmission } from "@/lib/notifications";
import {
  allowedPlacements,
  resolvePlacement,
  countAdsForBusiness,
  MAX_ADS_PER_BUSINESS,
} from "@/lib/ads/submissions";

const submitSchema = z
  .object({
    businessId: z.number().int().positive(),
    title: z.string().trim().min(1, "Give the ad a title").max(200),
    imageUrl: z.string().trim().min(1, "Upload your artwork").max(500),
    placement: z.enum(["banner", "sidebar"], {
      message: "Choose where the ad should appear",
    }),
    // "own" links to this business's own directory page — the business does not
    // get to point an ad at somebody else's listing.
    linkType: z.enum(["own", "external", "none"]).default("none"),
    linkUrl: z.string().trim().max(500).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.linkType !== "external") return;
    if (!data.linkUrl) {
      ctx.addIssue({ code: "custom", path: ["linkUrl"], message: "Enter the web address" });
    } else if (!isSafeExternalUrl(data.linkUrl)) {
      ctx.addIssue({
        code: "custom",
        path: ["linkUrl"],
        message: "Enter a valid web address, e.g. mybusiness.com",
      });
    }
  });

/**
 * Loads a business the signed-in user owns, with the plan flags that decide what
 * they may submit. Returns null when it is not theirs — ownership is checked
 * here rather than trusted from the request.
 */
async function loadOwnedBusiness(businessId: number, userId: number) {
  const [row] = await db
    .select({
      id: businesses.id,
      userId: businesses.userId,
      name: businesses.name,
      showInHomepageBanner: subscriptionPlans.showInHomepageBanner,
      showInHomepageSidebar: subscriptionPlans.showInHomepageSidebar,
    })
    .from(businesses)
    .leftJoin(subscriptionPlans, eq(businesses.subscriptionPlanId, subscriptionPlans.id))
    .where(eq(businesses.id, businessId))
    .limit(1);

  if (!row || row.userId !== userId) return null;
  return row;
}

/** GET — this business's own ads and their review status. */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = parseInt(request.nextUrl.searchParams.get("businessId") ?? "", 10);
  if (!Number.isInteger(businessId) || businessId <= 0) {
    return NextResponse.json({ error: "Missing businessId" }, { status: 400 });
  }

  const business = await loadOwnedBusiness(businessId, parseInt(session.user.id));
  if (!business) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ads = await db
    .select({
      id: homepageAds.id,
      title: homepageAds.title,
      imageUrl: homepageAds.imageUrl,
      placement: homepageAds.placement,
      linkType: homepageAds.linkType,
      linkUrl: homepageAds.linkUrl,
      approvalStatus: homepageAds.approvalStatus,
      rejectionReason: homepageAds.rejectionReason,
      isActive: homepageAds.isActive,
      clickCount: homepageAds.clickCount,
      createdAt: homepageAds.createdAt,
    })
    .from(homepageAds)
    .where(eq(homepageAds.businessId, businessId))
    .orderBy(desc(homepageAds.createdAt), desc(homepageAds.id));

  return NextResponse.json({
    ads,
    allowedPlacements: allowedPlacements(business),
    remaining: Math.max(0, MAX_ADS_PER_BUSINESS - ads.length),
  });
}

/** POST — submit artwork for review. */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Returns a ready-made response when the caller may not post, null when
    // they may — the same shape the other 23 submission endpoints use.
    const notAllowed = await assertCanPost(session.user.id);
    if (notAllowed) return notAllowed;

    const body = await request.json();
    const result = submitSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }
    const data = result.data;

    const business = await loadOwnedBusiness(data.businessId, parseInt(session.user.id));
    if (!business) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // The plan decides what may be submitted. Checked server-side because the
    // form only hides the option — hiding is not a control.
    const allowed = allowedPlacements(business);
    if (!allowed.includes(data.placement)) {
      return NextResponse.json(
        { error: "Your current plan does not include that homepage position" },
        { status: 403 }
      );
    }

    const existing = await countAdsForBusiness(data.businessId);
    if (existing >= MAX_ADS_PER_BUSINESS) {
      return NextResponse.json(
        {
          error: `You can have up to ${MAX_ADS_PER_BUSINESS} ads on file. Delete one to add another.`,
        },
        { status: 400 }
      );
    }

    const linkType = data.linkType === "own" ? "business" : data.linkType;
    const linkUrl = linkType === "external" ? normalizeExternalUrl(data.linkUrl) : null;

    const [ad] = await db
      .insert(homepageAds)
      .values({
        title: data.title,
        imageUrl: data.imageUrl,
        placement: await resolvePlacement(data.placement),
        linkType,
        linkUrl,
        businessId: data.businessId,
        submittedBy: parseInt(session.user.id),
        // Pending, unlike the admin route which approves on insert. Review is
        // the entire point of this path.
        approvalStatus: "pending",
      })
      .returning();

    // Without this the submission sits in the queue unseen — the business is
    // told it is "under review" by a review nobody was told about. Fully
    // try/caught inside, so a notification failure cannot fail the submission.
    await notifyAdminOfSubmission({
      contentType: "homepage_ad",
      title: `Homepage ad submitted: ${business.name}`,
      body:
        `Business: ${business.name}\n` +
        `Position: ${data.placement}\n` +
        `Title: ${data.title}`,
      linkUrl: "/admin/businesses/ads",
      status: "pending",
    });

    return NextResponse.json(ad, { status: 201 });
  } catch (error) {
    console.error("[ADS] Failed to submit ad:", error);
    return NextResponse.json({ error: "Failed to submit the ad" }, { status: 500 });
  }
}
