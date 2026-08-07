import { NextRequest, NextResponse } from "next/server";
import { communityClassifiedSchema } from "@/lib/validations/community-submissions";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { classifieds } from "@/lib/db/schema";
import { notifyAdminOfSubmission } from "@/lib/notifications";
import { assertCanPost } from "@/lib/auth/require-verified";
import { resolveApprovalStatus } from "@/lib/submissions/auto-approve";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Submissions require a verified email address (admins exempt). Also
    // re-checks the account is not disabled, since a session can outlive a block.
    const notAllowed = await assertCanPost(session?.user?.id);
    if (notAllowed) return notAllowed;

    const body = await request.json();

    // Raw body before this: no length cap on title (varchar 255), no email
    // check, and `price` went to a decimal(10,2) uncoerced.
    const parsed = communityClassifiedSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
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
    } = parsed.data;

    // Check auto-approve permission
    const userId = parseInt(session.user.id);
    const autoApprove =
      (await resolveApprovalStatus(
        "classified",
        userId,
        session.user.role,
        null
      )) === "approved";

    // Set expiration to 30 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const [created] = await db
      .insert(classifieds)
      .values({
        userId,
        title,
        description,
        categoryId,
        // decimal(10,2) is a string column in Drizzle; the schema has already
        // proved this is a real, in-range number.
        price: price == null ? null : String(price),
        priceType: priceType ?? null,
        contactName,
        contactEmail,
        contactPhone,
        location,
        imageUrl,
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
