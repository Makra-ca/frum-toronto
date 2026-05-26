import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businesses, businessCategories } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/admin/businesses/video-review - List businesses pending video approval
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        slug: businesses.slug,
        muxPlaybackId: businesses.muxPlaybackId,
        muxAssetId: businesses.muxAssetId,
        videoStatus: businesses.videoStatus,
        videoApprovalStatus: businesses.videoApprovalStatus,
        videoRejectionReason: businesses.videoRejectionReason,
        categoryName: businessCategories.name,
        updatedAt: businesses.updatedAt,
      })
      .from(businesses)
      .leftJoin(businessCategories, eq(businesses.categoryId, businessCategories.id))
      .where(
        and(
          eq(businesses.videoStatus, "ready"),
          eq(businesses.videoApprovalStatus, "pending")
        )
      )
      .orderBy(businesses.updatedAt);

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error("[Video Review] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch video review queue" },
      { status: 500 }
    );
  }
}
