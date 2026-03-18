import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shulDocuments } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { canUserManageShul } from "@/lib/auth/permissions";
import { z } from "zod";

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

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Error creating shul document:", error);
    return NextResponse.json({ error: "Failed to create document" }, { status: 500 });
  }
}
