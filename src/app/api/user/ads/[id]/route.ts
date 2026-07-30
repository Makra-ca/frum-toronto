import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { homepageAds, businesses } from "@/lib/db/schema";
import { normalizeExternalUrl, isSafeExternalUrl, isUploadedImageUrl } from "@/lib/safe-url";
import { assertCanPost } from "@/lib/auth/require-verified";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const editSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    imageUrl: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .refine(isUploadedImageUrl, "Upload your artwork rather than linking to an image elsewhere")
      .optional(),
    linkType: z.enum(["own", "external", "none"]).optional(),
    linkUrl: z.string().trim().max(500).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.linkType !== "external") return;
    if (!data.linkUrl || !isSafeExternalUrl(data.linkUrl)) {
      ctx.addIssue({
        code: "custom",
        path: ["linkUrl"],
        message: "Enter a valid web address, e.g. mybusiness.com",
      });
    }
  });

/**
 * Loads an ad the signed-in user owns, via the business it belongs to.
 *
 * Ownership runs ad -> business -> user rather than trusting `submitted_by`,
 * because an ad an admin created on a business's behalf still belongs to that
 * business, and staff can change.
 */
async function loadOwnAd(adId: number, userId: number) {
  const [row] = await db
    .select({
      id: homepageAds.id,
      approvalStatus: homepageAds.approvalStatus,
      ownerId: businesses.userId,
    })
    .from(homepageAds)
    .innerJoin(businesses, eq(homepageAds.businessId, businesses.id))
    .where(eq(homepageAds.id, adId))
    .limit(1);

  if (!row || row.ownerId !== userId) return null;
  return row;
}

/**
 * PATCH — replace artwork or change the link.
 *
 * Any edit sends the ad back to `pending`. Otherwise an approved ad would be a
 * standing permission to display anything: swap the image after approval and
 * the review that let it onto the homepage no longer describes what is there.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const adId = parseInt(id, 10);
    if (!Number.isInteger(adId) || adId <= 0) {
      return NextResponse.json({ error: "Invalid ad id" }, { status: 400 });
    }

    // Re-checked at WRITE time, not trusted from sign-in. `isActive` is read
    // only in the signIn/authorize callbacks, never in the jwt/session ones, so
    // a JWT outlives a ban — a disabled advertiser's live session could
    // otherwise still swap their ad's image and link. POST had this gate from
    // the start; PATCH and DELETE did not.
    const notAllowed = await assertCanPost(session.user.id);
    if (notAllowed) return notAllowed;

    const owned = await loadOwnAd(adId, parseInt(session.user.id));
    if (!owned) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const result = editSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }
    const data = result.data;

    const updates: Partial<typeof homepageAds.$inferInsert> = {
      approvalStatus: "pending",
      // Clear any previous rejection note, or a resubmitted ad still shows the
      // reason the old version was turned down.
      rejectionReason: null,
      updatedAt: new Date(),
    };

    if (data.title !== undefined) updates.title = data.title;
    if (data.imageUrl !== undefined) updates.imageUrl = data.imageUrl;

    if (data.linkType !== undefined) {
      updates.linkType = data.linkType === "own" ? "business" : data.linkType;
      updates.linkUrl =
        data.linkType === "external" ? normalizeExternalUrl(data.linkUrl) : null;
    }

    const [updated] = await db
      .update(homepageAds)
      .set(updates)
      .where(eq(homepageAds.id, adId))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[ADS] Failed to edit submission:", error);
    return NextResponse.json({ error: "Failed to update the ad" }, { status: 500 });
  }
}

/**
 * DELETE — withdraw an ad.
 *
 * Allowed at any status, including approved: a business must be able to pull its
 * own advertising without waiting on an admin.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const adId = parseInt(id, 10);
    if (!Number.isInteger(adId) || adId <= 0) {
      return NextResponse.json({ error: "Invalid ad id" }, { status: 400 });
    }

    // Same reasoning as PATCH: a banned account's session must not still be able
    // to mutate its advertising.
    const notAllowed = await assertCanPost(session.user.id);
    if (notAllowed) return notAllowed;

    const owned = await loadOwnAd(adId, parseInt(session.user.id));
    if (!owned) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await db.delete(homepageAds).where(eq(homepageAds.id, adId));
    return NextResponse.json({ message: "Ad removed" });
  } catch (error) {
    console.error("[ADS] Failed to delete submission:", error);
    return NextResponse.json({ error: "Failed to remove the ad" }, { status: 500 });
  }
}
