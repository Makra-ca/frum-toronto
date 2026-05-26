import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// POST /api/businesses/[id]/video/uploaded - Called after MUX uploader completes
// Confirms the upload ID is saved and advances status to "uploading"
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const businessId = parseInt(id);

    if (isNaN(businessId)) {
      return NextResponse.json({ error: "Invalid business ID" }, { status: 400 });
    }

    const userId = parseInt(session.user.id);
    const isAdmin = session.user.role === "admin";

    const body = await request.json();
    const { uploadId } = body;

    if (!uploadId || typeof uploadId !== "string") {
      return NextResponse.json({ error: "uploadId is required" }, { status: 400 });
    }

    // Fetch business
    const [business] = await db
      .select({
        id: businesses.id,
        userId: businesses.userId,
        muxUploadId: businesses.muxUploadId,
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

    // Verify the uploadId matches what we stored
    if (business.muxUploadId !== uploadId) {
      return NextResponse.json(
        { error: "Upload ID does not match" },
        { status: 400 }
      );
    }

    // Advance status to uploading (MUX webhook will advance to processing then ready)
    await db
      .update(businesses)
      .set({
        videoStatus: "uploading",
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, businessId));

    return NextResponse.json({ success: true, message: "Video upload confirmed" });
  } catch (error) {
    console.error("[MUX] Error confirming upload:", error);
    return NextResponse.json(
      { error: "Failed to confirm video upload" },
      { status: 500 }
    );
  }
}
