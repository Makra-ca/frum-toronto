import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { setApprovalStatus } from "@/lib/submissions/set-approval-status";
import type { SubmissionType } from "@/lib/submissions/types";

// The route's URL segment → the submission type. The segments are plural table
// names for historical reasons and cannot change without breaking the admin UI.
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

    // Parse request body for additional options (like isPermanent for tehillim)
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // No body provided, which is fine
    }

    const submissionType = typeMap[type];
    if (!submissionType) {
      return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
    }

    const extraFields: Record<string, unknown> = {};
    if (submissionType === "tehillim" && "isPermanent" in body) {
      extraFields.isPermanent = body.isPermanent;
      // If making permanent, clear the expiration date
      if (body.isPermanent) extraFields.expiresAt = null;
    }

    // The broadcast decision and the submitter notification both live in
    // setApprovalStatus. Nothing here decides either — that is the point of it.
    const result = await setApprovalStatus({
      type: submissionType,
      id: parseInt(id),
      next: "approved",
      extraFields,
    });

    if (!result.changed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ message: `${type} approved successfully` });
  } catch (error) {
    console.error("Failed to approve content:", error);
    return NextResponse.json(
      { error: "Failed to approve content" },
      { status: 500 }
    );
  }
}
