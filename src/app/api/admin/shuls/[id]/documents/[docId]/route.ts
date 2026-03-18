import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shulDocuments, shuls } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { del } from "@vercel/blob";
import { z } from "zod";

const updateDocumentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  type: z.enum(["newsletter", "tefillah"]).optional(),
  description: z.string().optional().nullable(),
  fileUrl: z.string().url().optional(),
  fileSize: z.number().optional().nullable(),
});

// PATCH /api/admin/shuls/[id]/documents/[docId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, docId } = await params;
    const shulId = parseInt(id);
    const documentId = parseInt(docId);

    const body = await request.json();
    const result = updateDocumentSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const [updated] = await db
      .update(shulDocuments)
      .set(result.data)
      .where(and(eq(shulDocuments.id, documentId), eq(shulDocuments.shulId, shulId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const [shul] = await db.select({ slug: shuls.slug }).from(shuls).where(eq(shuls.id, shulId)).limit(1);
    if (shul) revalidatePath(`/shuls/${shul.slug}`);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating shul document:", error);
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
  }
}

// DELETE /api/admin/shuls/[id]/documents/[docId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, docId } = await params;
    const shulId = parseInt(id);
    const documentId = parseInt(docId);

    // Get document to delete file from blob
    const [document] = await db
      .select()
      .from(shulDocuments)
      .where(and(eq(shulDocuments.id, documentId), eq(shulDocuments.shulId, shulId)))
      .limit(1);

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Delete from Vercel Blob
    try {
      await del(document.fileUrl);
    } catch (e) {
      console.error("Error deleting file from blob:", e);
    }

    // Delete from database
    await db
      .delete(shulDocuments)
      .where(eq(shulDocuments.id, documentId));

    // Revalidate the public shul page
    const [shul] = await db.select({ slug: shuls.slug }).from(shuls).where(eq(shuls.id, shulId)).limit(1);
    if (shul) revalidatePath(`/shuls/${shul.slug}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting shul document:", error);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
