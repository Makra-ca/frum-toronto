import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shulDocuments, shuls } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { canUserManageShul } from "@/lib/auth/permissions";
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

const createDocumentSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  type: z.enum(["newsletter", "tefillah"]),
  fileUrl: z.string().url("Valid file URL is required"),
  fileSize: z.number().optional().nullable(),
  description: z.string().optional().nullable(),
});

// GET /api/shuls/[id]/documents - Get documents (authenticated, for shul managers)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const shulId = parseInt(id);

    // Admin or shul manager
    const canManage = await canUserManageShul(parseInt(session.user.id), shulId, session.user.role);
    if (!canManage && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const documents = await db
      .select()
      .from(shulDocuments)
      .where(eq(shulDocuments.shulId, shulId))
      .orderBy(desc(shulDocuments.publishedAt));

    return NextResponse.json(documents);
  } catch (error) {
    console.error("Error fetching shul documents:", error);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}

// POST /api/shuls/[id]/documents - Upload document (shul manager or admin)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const shulId = parseInt(id);

    const canManage = await canUserManageShul(parseInt(session.user.id), shulId, session.user.role);
    if (!canManage && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const result = createDocumentSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const [document] = await db
      .insert(shulDocuments)
      .values({
        shulId,
        title: result.data.title,
        type: result.data.type,
        fileUrl: result.data.fileUrl,
        fileSize: result.data.fileSize || null,
        description: result.data.description || null,
        uploadedBy: parseInt(session.user.id),
      })
      .returning();

    // Notify admins (Tier C FYI — document uploads go live without review)
    const shulName = await getShulName(shulId);
    await notifyAdminOfSubmission({
      contentType: "shul_document",
      title: `Shul document uploaded: ${shulName}`,
      body:
        `Shul: ${shulName}\n` +
        `Document: ${result.data.title} (${result.data.type})\n` +
        `Uploaded by: ${session.user.name || session.user.email || "Unknown user"}`,
      linkUrl: "/admin/shuls",
      status: "auto_approved",
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Error creating shul document:", error);
    return NextResponse.json({ error: "Failed to create document" }, { status: 500 });
  }
}
