import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { askTheRabbiSubmissions, askTheRabbi } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

// GET - Get single submission details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const submissionId = parseInt(id);

    if (isNaN(submissionId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const [submission] = await db
      .select()
      .from(askTheRabbiSubmissions)
      .where(eq(askTheRabbiSubmissions.id, submissionId))
      .limit(1);

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    return NextResponse.json(submission);
  } catch (error) {
    console.error("[API] Error fetching submission:", error);
    return NextResponse.json({ error: "Failed to fetch submission" }, { status: 500 });
  }
}

// PATCH - Update submission (reject, add notes, etc.)
const updateSchema = z.object({
  status: z.enum(["pending", "answered", "rejected"]).optional(),
  adminNotes: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const submissionId = parseInt(id);

    if (isNaN(submissionId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const result = updateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if (result.data.status !== undefined) {
      updates.status = result.data.status;
      updates.reviewedAt = new Date();
      updates.reviewedBy = parseInt(session.user.id);
    }

    if (result.data.adminNotes !== undefined) {
      updates.adminNotes = result.data.adminNotes;
    }

    const [updated] = await db
      .update(askTheRabbiSubmissions)
      .set(updates)
      .where(eq(askTheRabbiSubmissions.id, submissionId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[API] Error updating submission:", error);
    return NextResponse.json({ error: "Failed to update submission" }, { status: 500 });
  }
}

// DELETE - Delete a submission (and published question if exists)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const submissionId = parseInt(id);

    if (isNaN(submissionId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // First get the submission to check for linked published question
    const [submission] = await db
      .select()
      .from(askTheRabbiSubmissions)
      .where(eq(askTheRabbiSubmissions.id, submissionId))
      .limit(1);

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // If there's a linked published question, delete it first
    if (submission.publishedQuestionId) {
      await db
        .delete(askTheRabbi)
        .where(eq(askTheRabbi.id, submission.publishedQuestionId));
    }

    // Delete the submission
    await db
      .delete(askTheRabbiSubmissions)
      .where(eq(askTheRabbiSubmissions.id, submissionId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error deleting submission:", error);
    return NextResponse.json({ error: "Failed to delete submission" }, { status: 500 });
  }
}
