import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { specials, businesses, users } from "@/lib/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { specialSchema } from "@/lib/validations/specials";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const showAll = searchParams.get("showAll") === "true"; // For showing upcoming too

    const today = new Date().toISOString().split("T")[0];

    // Build conditions - only active and approved specials
    const conditions = [
      eq(specials.isActive, true),
      eq(specials.approvalStatus, "approved"),
    ];

    // By default, only show currently valid specials
    if (!showAll) {
      conditions.push(lte(specials.startDate, today));
      conditions.push(gte(specials.endDate, today));
    }

    const activeSpecials = await db
      .select({
        id: specials.id,
        title: specials.title,
        description: specials.description,
        fileUrl: specials.fileUrl,
        fileType: specials.fileType,
        startDate: specials.startDate,
        endDate: specials.endDate,
        viewCount: specials.viewCount,
        createdAt: specials.createdAt,
        // Business info
        businessId: specials.businessId,
        businessName: businesses.name,
        businessSlug: businesses.slug,
        businessLogo: businesses.logoUrl,
      })
      .from(specials)
      .leftJoin(businesses, eq(specials.businessId, businesses.id))
      .where(and(...conditions))
      .orderBy(desc(specials.createdAt));

    return NextResponse.json(activeSpecials);
  } catch (error) {
    console.error("Error fetching specials:", error);
    return NextResponse.json(
      { error: "Failed to fetch specials" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to post specials
    const userId = parseInt(session.user.id);
    const [user] = await db
      .select({
        role: users.role,
        canPostSpecials: users.canPostSpecials,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const canSubmit = user?.role === "admin" || user?.canPostSpecials;

    if (!canSubmit) {
      return NextResponse.json(
        { error: "You don't have permission to post specials. Please contact admin to become a verified business." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const result = specialSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { businessId, title, description, fileUrl, fileType, startDate, endDate } = result.data;

    // Verify the business exists
    const [business] = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 400 }
      );
    }

    // Admins auto-approve, others need approval
    const approvalStatus = user?.role === "admin" ? "approved" : "pending";

    const [newSpecial] = await db
      .insert(specials)
      .values({
        userId,
        businessId,
        title: title.trim(),
        description: description?.trim() || null,
        fileUrl,
        fileType,
        startDate,
        endDate,
        approvalStatus,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json(newSpecial, { status: 201 });
  } catch (error) {
    console.error("Error creating special:", error);
    return NextResponse.json(
      { error: "Failed to create special" },
      { status: 500 }
    );
  }
}
