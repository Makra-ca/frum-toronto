import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notifyAdminOfSubmission } from "@/lib/notifications";
import { assertCanPost } from "@/lib/auth/require-verified";
import { isUploadedImageUrl } from "@/lib/safe-url";

export const dynamic = "force-dynamic";

// POST /api/businesses/[id]/non-profit - Submit non-profit verification application
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Submissions require a verified email address (admins exempt). Also
    // re-checks the account is not disabled, since a session can outlive a block.
    const notAllowed = await assertCanPost(session?.user?.id);
    if (notAllowed) return notAllowed;

    const { id } = await params;
    const businessId = parseInt(id);

    if (isNaN(businessId)) {
      return NextResponse.json({ error: "Invalid business ID" }, { status: 400 });
    }

    const userId = parseInt(session.user.id);
    const isAdmin = session.user.role === "admin";

    const body = await request.json();
    const { documentUrl } = body;

    if (!documentUrl || typeof documentUrl !== "string") {
      return NextResponse.json({ error: "documentUrl is required" }, { status: 400 });
    }

    // Any string was accepted and stored, then shown to the admin reviewing the
    // charity claim — so the "proof" an admin clicked was a URL the claimant
    // chose, on a host they control, swappable after review. Constrained to our
    // own upload storage, the same rule shul documents and ad artwork use.
    if (!isUploadedImageUrl(documentUrl)) {
      return NextResponse.json(
        { error: "Upload the document rather than linking to one elsewhere" },
        { status: 400 }
      );
    }

    const [business] = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        userId: businesses.userId,
        nonProfitStatus: businesses.nonProfitStatus,
      })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Check ownership
    if (!isAdmin && business.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Can only apply when status is "none" or "rejected"
    if (business.nonProfitStatus === "pending") {
      return NextResponse.json(
        { error: "A non-profit application is already pending review" },
        { status: 400 }
      );
    }
    if (business.nonProfitStatus === "verified") {
      return NextResponse.json(
        { error: "This business is already verified as a non-profit" },
        { status: 400 }
      );
    }

    await db
      .update(businesses)
      .set({
        nonProfitDocumentUrl: documentUrl,
        nonProfitStatus: "pending",
        isNonProfit: false,
        nonProfitRejectionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, businessId));

    // Notify admins (in-app + instant email to non_profit recipients)
    await notifyAdminOfSubmission({
      contentType: "non_profit",
      title: `Non-profit application submitted — ${business.name}`,
      body:
        `Business: ${business.name}\n` +
        `Document: ${documentUrl}\n` +
        `Submitted by: ${session.user.name || session.user.email || "Unknown user"}`,
      linkUrl: "/admin/businesses/non-profit",
      status: "pending",
    });

    return NextResponse.json({
      success: true,
      message: "Non-profit application submitted. You will be notified once reviewed.",
    });
  } catch (error) {
    console.error("[Non-Profit Apply] Error:", error);
    return NextResponse.json(
      { error: "Failed to submit non-profit application" },
      { status: 500 }
    );
  }
}
