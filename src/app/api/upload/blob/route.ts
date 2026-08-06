import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/lib/auth/auth";
import { assertCanPost } from "@/lib/auth/require-verified";

// Client-side direct-to-Blob upload token route.
//
// Why this exists: the legacy /api/upload streams the whole file THROUGH the
// serverless function (request.formData()), and Vercel rejects any request
// body over ~4.5 MB before the handler runs — so large PDFs (shul newsletters,
// flyers, etc.) failed with a confusing non-JSON error. Client uploads send the
// file straight to Vercel Blob and only exchange a small JSON token here, so
// they aren't bound by the function body limit (supports very large files).

const MAX_UPLOAD_SIZE = 30 * 1024 * 1024; // 30 MB (covers large newsletter PDFs)

const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  // Checked here rather than inside onBeforeGenerateToken because a throw in
  // there surfaces as a generic 400, losing the `email_unverified` code the UI
  // uses to offer "resend verification". Every form that uploads is gated on
  // assertCanPost at submit time; without it here, a blocked account could
  // still push 30 MB into our Blob store on demand.
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const notAllowed = await assertCanPost(session.user.id);
  if (notAllowed) return notAllowed;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        // Only authenticated users may obtain an upload token.
        const session = await auth();
        if (!session?.user) {
          throw new Error("Unauthorized");
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_SIZE,
          addRandomSuffix: true,
        };
      },
      // No onUploadCompleted: callers create their DB record in a follow-up
      // request after upload() resolves (same two-step flow as before).
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("[UPLOAD] Client upload token error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 }
    );
  }
}
