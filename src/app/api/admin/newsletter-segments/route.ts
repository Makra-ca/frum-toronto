import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { newsletterSegments, emailSubscribers } from "@/lib/db/schema";
import { segmentSchema } from "@/lib/validations/newsletter";
import { desc, eq, and, sql } from "drizzle-orm";
import type { FilterCriteria } from "@/types/newsletter";

// GET - List all segments
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const segments = await db
      .select()
      .from(newsletterSegments)
      .orderBy(desc(newsletterSegments.isDefault), desc(newsletterSegments.createdAt));

    // Get subscriber count for each segment
    const segmentsWithCounts = await Promise.all(
      segments.map(async (segment) => {
        const filterCriteria = segment.filterCriteria as FilterCriteria | null;

        // Build conditions based on filter criteria
        const conditions = [
          eq(emailSubscribers.isActive, true),
          sql`${emailSubscribers.unsubscribedAt} IS NULL`,
        ];

        if (filterCriteria) {
          if (filterCriteria.newsletter !== undefined) {
            conditions.push(eq(emailSubscribers.newsletter, filterCriteria.newsletter));
          }
          if (filterCriteria.kosherAlerts !== undefined) {
            conditions.push(eq(emailSubscribers.kosherAlerts, filterCriteria.kosherAlerts));
          }
          if (filterCriteria.eruvStatus !== undefined) {
            conditions.push(eq(emailSubscribers.eruvStatus, filterCriteria.eruvStatus));
          }
          if (filterCriteria.simchas !== undefined) {
            conditions.push(eq(emailSubscribers.simchas, filterCriteria.simchas));
          }
          if (filterCriteria.shiva !== undefined) {
            conditions.push(eq(emailSubscribers.shiva, filterCriteria.shiva));
          }
        }

        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(emailSubscribers)
          .where(and(...conditions));

        return {
          ...segment,
          subscriberCount: Number(count),
        };
      })
    );

    return NextResponse.json(segmentsWithCounts);
  } catch (error) {
    console.error("Error fetching segments:", error);
    return NextResponse.json(
      { error: "Failed to fetch segments" },
      { status: 500 }
    );
  }
}

// POST - Create new segment
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = segmentSchema.parse(body);

    // If this is set as default, unset other defaults
    if (validatedData.isDefault) {
      await db
        .update(newsletterSegments)
        .set({ isDefault: false });
    }

    const [newSegment] = await db
      .insert(newsletterSegments)
      .values({
        name: validatedData.name,
        description: validatedData.description || null,
        filterCriteria: validatedData.filterCriteria || null,
        isDefault: validatedData.isDefault || false,
      })
      .returning();

    return NextResponse.json(newSegment, { status: 201 });
  } catch (error) {
    console.error("Error creating segment:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid data", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create segment" },
      { status: 500 }
    );
  }
}
