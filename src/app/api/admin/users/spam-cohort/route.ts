import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { findSpamCandidates, SPAM_COHORT_DAYS } from "@/lib/admin/spam-cohort";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users/spam-cohort
 *
 * Accounts safe to clear in bulk: unverified, created in the last 30 days, and
 * owning nothing anywhere. Read-only — deletion still goes one at a time
 * through DELETE /api/admin/users/[id], so every removal is guarded and audited
 * individually.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const candidates = await findSpamCandidates();

    return NextResponse.json({
      candidates,
      windowDays: SPAM_COHORT_DAYS,
      count: candidates.length,
    });
  } catch (error) {
    console.error("Failed to load spam cohort:", error);
    return NextResponse.json(
      { error: "Failed to load spam cohort" },
      { status: 500 }
    );
  }
}
