import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { newsletters } from "@/lib/db/schema";
import { newsletterSchema } from "@/lib/validations/newsletter";
import { desc, eq, sql } from "drizzle-orm";

// GET - List all newsletters
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = db.select().from(newsletters);

    if (status) {
      query = query.where(eq(newsletters.status, status)) as typeof query;
    }

    const results = await query
      .orderBy(desc(newsletters.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(newsletters);

    return NextResponse.json({
      newsletters: results,
      total: Number(count),
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching newsletters:", error);
    return NextResponse.json(
      { error: "Failed to fetch newsletters" },
      { status: 500 }
    );
  }
}

// POST - Create new newsletter
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = newsletterSchema.parse(body);

    const [newNewsletter] = await db
      .insert(newsletters)
      .values({
        title: validatedData.title,
        subject: validatedData.subject,
        previewText: validatedData.previewText || null,
        content: validatedData.content,
        contentJson: validatedData.contentJson || null,
        status: validatedData.status || "draft",
        scheduledAt: validatedData.scheduledAt
          ? new Date(validatedData.scheduledAt)
          : null,
        createdBy: parseInt(session.user.id),
      })
      .returning();

    return NextResponse.json(newNewsletter, { status: 201 });
  } catch (error) {
    console.error("Error creating newsletter:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid data", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create newsletter" },
      { status: 500 }
    );
  }
}
