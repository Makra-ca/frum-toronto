import { NextRequest } from "next/server";
import {
  handleSubmissionGet,
  handleSubmissionEdit,
} from "@/lib/submissions/edit-route";

/**
 * A submitter's own classified listing: read it back for the edit form, and save changes.
 *
 * Both delegate to the shared handler, which runs the six mandatory steps —
 * 401, assertCanPost, 403 for non-owners, field whitelist, shared status
 * resolution, and a conditional write that 409s.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleSubmissionGet("classified", params);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleSubmissionEdit("classified", request, params);
}
