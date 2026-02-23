import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { specials, businesses, users } from "@/lib/db/schema";
import { eq, and, or, ilike, desc, sql } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { adminSpecialSchema } from "@/lib/validations/specials";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [];

    if (status !== "all") {
      if (status === "active") {
        conditions.push(eq(specials.isActive, true));
      } else if (status === "inactive") {
        conditions.push(eq(specials.isActive, false));
      } else {
        conditions.push(eq(specials.approvalStatus, status));
      }
    }

    if (search?.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(specials.title, searchTerm),
          ilike(businesses.name, searchTerm)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get count
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(specials)
      .leftJoin(businesses, eq(specials.businessId, businesses.id));

    if (whereClause) {
      countQuery.where(whereClause);
    }

    const [countResult] = await countQuery;
    const totalCount = Number(countResult?.count || 0);

    // Get data
    const dataQuery = db
      .select({
        id: specials.id,
        title: specials.title,
        description: specials.description,
        fileUrl: specials.fileUrl,
        fileType: specials.fileType,
        startDate: specials.startDate,
        endDate: specials.endDate,
        approvalStatus: specials.approvalStatus,
        isActive: specials.isActive,
        viewCount: specials.viewCount,
        createdAt: specials.createdAt,
        // Business info
        businessId: specials.businessId,
        businessName: businesses.name,
        // Submitter info
        userId: specials.userId,
        userEmail: users.email,
      })
      .from(specials)
      .leftJoin(businesses, eq(specials.businessId, businesses.id))
      .leftJoin(users, eq(specials.userId, users.id))
      .orderBy(desc(specials.createdAt))
      .limit(limit)
      .offset(offset);

    if (whereClause) {
      dataQuery.where(whereClause);
    }

    const specialsList = await dataQuery;

    return NextResponse.json({
      specials: specialsList,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
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

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const result = adminSpecialSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { businessId, title, description, fileUrl, fileType, startDate, endDate, approvalStatus, isActive } = result.data;

    const [newSpecial] = await db
      .insert(specials)
      .values({
        userId: parseInt(session.user.id),
        businessId,
        title: title.trim(),
        description: description?.trim() || null,
        fileUrl,
        fileType,
        startDate,
        endDate,
        approvalStatus: approvalStatus || "approved", // Admin posts are auto-approved
        isActive: isActive ?? true,
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
