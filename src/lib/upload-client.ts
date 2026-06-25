import { upload } from "@vercel/blob/client";

export interface UploadResult {
  url: string;
  pathname: string;
}

/**
 * Upload a file directly to Vercel Blob from the browser.
 *
 * Use this instead of POSTing FormData to /api/upload for anything that can be
 * large (PDFs especially). Direct client uploads bypass Vercel's ~4.5 MB
 * serverless request-body limit, so large newsletter/flyer PDFs work.
 *
 * @param file   The File to upload.
 * @param folder Logical folder prefix for the blob path (e.g. "shul-documents/12").
 * @returns      { url, pathname } — same shape the old /api/upload returned.
 */
export async function uploadFile(file: File, folder = "general"): Promise<UploadResult> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const pathname = `${folder}/${safeName}`;

  const blob = await upload(pathname, file, {
    access: "public",
    handleUploadUrl: "/api/upload/blob",
    // addRandomSuffix is set server-side in onBeforeGenerateToken, so repeated
    // uploads of the same filename won't collide.
  });

  return { url: blob.url, pathname: blob.pathname };
}
