import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { newsletters } from "@/lib/db/schema";
import { newsletterSchema } from "@/lib/validations/newsletter";
import { eq } from "drizzle-orm";

// GET - Get single newsletter
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const newsletterId = parseInt(id);

    if (isNaN(newsletterId)) {
      return NextResponse.json(
        { error: "Invalid newsletter ID" },
        { status: 400 }
      );
    }

    const [newsletter] = await db
      .select()
      .from(newsletters)
      .where(eq(newsletters.id, newsletterId))
      .limit(1);

    if (!newsletter) {
      return NextResponse.json(
        { error: "Newsletter not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(newsletter);
  } catch (error) {
    console.error("Error fetching newsletter:", error);
    return NextResponse.json(
      { error: "Failed to fetch newsletter" },
      { status: 500 }
    );
  }
}

// PUT - Update newsletter
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const newsletterId = parseInt(id);

    if (isNaN(newsletterId)) {
      return NextResponse.json(
        { error: "Invalid newsletter ID" },
        { status: 400 }
      );
    }

    // Check if newsletter exists
    const [existing] = await db
      .select()
      .from(newsletters)
      .where(eq(newsletters.id, newsletterId))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Newsletter not found" },
        { status: 404 }
      );
    }

    // Can't edit sent newsletters
    if (existing.status === "sent" || existing.status === "sending") {
      return NextResponse.json(
        { error: "Cannot edit a newsletter that is being sent or has been sent" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = newsletterSchema.parse(body);

    const [updated] = await db
      .update(newsletters)
      .set({
        title: validatedData.title,
        subject: validatedData.subject,
        previewText: validatedData.previewText || null,
        content: validatedData.content,
        contentJson: validatedData.contentJson || null,
        status: validatedData.status,
        scheduledAt: validatedData.scheduledAt
          ? new Date(validatedData.scheduledAt)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(newsletters.id, newsletterId))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating newsletter:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid data", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update newsletter" },
      { status: 500 }
    );
  }
}

// DELETE - Delete newsletter
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const newsletterId = parseInt(id);

    if (isNaN(newsletterId)) {
      return NextResponse.json(
        { error: "Invalid newsletter ID" },
        { status: 400 }
      );
    }

    // Check if newsletter exists
    const [existing] = await db
      .select()
      .from(newsletters)
      .where(eq(newsletters.id, newsletterId))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Newsletter not found" },
        { status: 404 }
      );
    }

    // Can't delete newsletter that is being sent
    if (existing.status === "sending") {
      return NextResponse.json(
        { error: "Cannot delete a newsletter that is being sent" },
        { status: 400 }
      );
    }

    await db.delete(newsletters).where(eq(newsletters.id, newsletterId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting newsletter:", error);
    return NextResponse.json(
      { error: "Failed to delete newsletter" },
      { status: 500 }
    );
  }
}
