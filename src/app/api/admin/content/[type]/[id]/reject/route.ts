import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { setApprovalStatus } from "@/lib/submissions/set-approval-status";
import type { SubmissionType } from "@/lib/submissions/types";

const typeMap: Record<string, SubmissionType> = {
  simchas: "simcha",
  classifieds: "classified",
  events: "event",
  tehillim: "tehillim",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { type, id } = await params;

    // The reason is optional by decision. Blank is a supported answer, not a
    // missing one — the email then writes a considered fallback rather than
    // leaving the submitter with a bare "not approved".
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // No body provided, which is fine
    }
    const reason =
      typeof body.rejectionReason === "string" && body.rejectionReason.trim()
        ? body.rejectionReason.trim()
        : null;

    const submissionType = typeMap[type];
    if (!submissionType) {
      return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
    }

    const result = await setApprovalStatus({
      type: submissionType,
      id: parseInt(id),
      next: "rejected",
      rejectionReason: reason,
    });

    if (!result.changed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ message: `${type} rejected` });
  } catch (error) {
    console.error("Failed to reject content:", error);
    return NextResponse.json(
      { error: "Failed to reject content" },
      { status: 500 }
    );
  }
}
