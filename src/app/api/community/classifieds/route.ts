import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { classifieds, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notifyAdminOfSubmission } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      description,
      categoryId,
      price,
      priceType,
      contactName,
      contactEmail,
      contactPhone,
      location,
      imageUrl,
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!description?.trim() || description.trim().length < 10) {
      return NextResponse.json(
        { error: "Description must be at least 10 characters" },
        { status: 400 }
      );
    }
    if (description.trim().length > 2000) {
      return NextResponse.json(
        { error: "Description must be 2,000 characters or less" },
        { status: 400 }
      );
    }
    if (!categoryId) {
      return NextResponse.json({ error: "Category is required" }, { status: 400 });
    }

    // Check auto-approve permission
    const userId = parseInt(session.user.id);
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const autoApprove =
      dbUser?.canAutoApproveClassifieds || session.user.role === "admin";

    // Set expiration to 30 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const [created] = await db
      .insert(classifieds)
      .values({
        userId,
        title: title.trim(),
        description: description.trim(),
        categoryId: parseInt(categoryId),
        price: price || null,
        priceType: priceType || null,
        contactName: contactName?.trim() || null,
        contactEmail: contactEmail?.trim() || null,
        contactPhone: contactPhone?.trim() || null,
        location: location?.trim() || null,
        imageUrl: imageUrl || null,
        expiresAt,
        approvalStatus: autoApprove ? "approved" : "pending",
        isActive: true,
      })
      .returning();

    // Notify admins (Tier B: in-app only; digest picks up pending rows)
    await notifyAdminOfSubmission({
      contentType: "classified",
      title: `New classified submitted: ${title.trim()}`,
      body:
        `${title.trim()}\n` +
        `Submitted by: ${session.user.name || session.user.email || "Unknown user"}`,
      linkUrl: "/admin/programs/classifieds",
      status: autoApprove ? "auto_approved" : "pending",
    });

    return NextResponse.json(
      {
        classified: created,
        message: autoApprove
          ? "Classified posted successfully!"
          : "Classified submitted for review. It will appear once approved.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API] Error creating classified:", error);
    return NextResponse.json(
      { error: "Failed to submit classified" },
      { status: 500 }
    );
  }
}
