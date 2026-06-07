import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shulDocuments, shuls } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { canUserManageShul } from "@/lib/auth/permissions";
import { del } from "@vercel/blob";
import { z } from "zod";
import { notifyAdminOfSubmission } from "@/lib/notifications";

// Notification prep only — never let a name lookup fail the request
async function getShulName(shulId: number): Promise<string> {
  try {
    const [shul] = await db
      .select({ name: shuls.name })
      .from(shuls)
      .where(eq(shuls.id, shulId))
      .limit(1);
    return shul?.name || `Shul #${shulId}`;
  } catch {
    return `Shul #${shulId}`;
  }
}

const updateDocumentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  type: z.enum(["newsletter", "tefillah"]).optional(),
  description: z.string().optional().nullable(),
  fileUrl: z.string().url().optional(),
  fileSize: z.number().optional().nullable(),
});

// PATCH /api/shuls/[id]/documents/[docId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, docId } = await params;
    const shulId = parseInt(id);
    const documentId = parseInt(docId);

    const canManage = await canUserManageShul(parseInt(session.user.id), shulId, session.user.role);
    if (!canManage && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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

    // Notify admins (Tier C FYI — document edits go live without review)
    const shulName = await getShulName(shulId);
    await notifyAdminOfSubmission({
      contentType: "shul_document",
      title: `Shul document updated: ${shulName}`,
      body:
        `Shul: ${shulName}\n` +
        `Document: ${updated.title} (${updated.type})\n` +
        `Updated by: ${session.user.name || session.user.email || "Unknown user"}`,
      linkUrl: `/admin/shuls/${shulId}`,
      status: "auto_approved",
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating shul document:", error);
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
  }
}

// DELETE /api/shuls/[id]/documents/[docId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, docId } = await params;
    const shulId = parseInt(id);
    const documentId = parseInt(docId);

    const canManage = await canUserManageShul(parseInt(session.user.id), shulId, session.user.role);
    if (!canManage && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [document] = await db
      .select()
      .from(shulDocuments)
      .where(and(eq(shulDocuments.id, documentId), eq(shulDocuments.shulId, shulId)))
      .limit(1);

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    try {
      await del(document.fileUrl);
    } catch (e) {
      console.error("Error deleting file from blob:", e);
    }

    await db.delete(shulDocuments).where(eq(shulDocuments.id, documentId));

    // Notify admins (Tier C FYI — document deletions go live without review)
    const shulName = await getShulName(shulId);
    await notifyAdminOfSubmission({
      contentType: "shul_document",
      title: `Shul document deleted: ${shulName}`,
      body:
        `Shul: ${shulName}\n` +
        `Document: ${document.title} (${document.type})\n` +
        `Deleted by: ${session.user.name || session.user.email || "Unknown user"}`,
      linkUrl: `/admin/shuls/${shulId}`,
      status: "auto_approved",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting shul document:", error);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
