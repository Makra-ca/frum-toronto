import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { emailSubscribers } from "@/lib/db/schema";
import { subscriberSchema } from "@/lib/validations/newsletter";
import { desc, eq, ilike, sql, or, and } from "drizzle-orm";
import crypto from "crypto";

// GET - List all subscribers with pagination and search
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const activeOnly = searchParams.get("activeOnly") === "true";

    const conditions = [];

    if (activeOnly) {
      conditions.push(eq(emailSubscribers.isActive, true));
      conditions.push(sql`${emailSubscribers.unsubscribedAt} IS NULL`);
    }

    if (search) {
      conditions.push(
        or(
          ilike(emailSubscribers.email, `%${search}%`),
          ilike(emailSubscribers.firstName, `%${search}%`),
          ilike(emailSubscribers.lastName, `%${search}%`)
        )
      );
    }

    let query = db.select().from(emailSubscribers);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const subscribers = await query
      .orderBy(desc(emailSubscribers.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    let countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(emailSubscribers);

    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions)) as typeof countQuery;
    }

    const [{ count }] = await countQuery;

    // Get stats
    const [{ activeCount }] = await db
      .select({ activeCount: sql<number>`count(*)` })
      .from(emailSubscribers)
      .where(
        and(
          eq(emailSubscribers.isActive, true),
          sql`${emailSubscribers.unsubscribedAt} IS NULL`
        )
      );

    return NextResponse.json({
      subscribers,
      total: Number(count),
      activeCount: Number(activeCount),
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching subscribers:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscribers" },
      { status: 500 }
    );
  }
}

// POST - Add new subscriber
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = subscriberSchema.parse(body);

    // Check if email already exists
    const [existing] = await db
      .select()
      .from(emailSubscribers)
      .where(eq(emailSubscribers.email, validatedData.email.toLowerCase()))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "Subscriber with this email already exists" },
        { status: 400 }
      );
    }

    // Generate unsubscribe token
    const unsubscribeToken = crypto.randomBytes(32).toString("hex");

    const [newSubscriber] = await db
      .insert(emailSubscribers)
      .values({
        email: validatedData.email.toLowerCase(),
        firstName: validatedData.firstName || null,
        lastName: validatedData.lastName || null,
        kosherAlerts: validatedData.kosherAlerts || false,
        eruvStatus: validatedData.eruvStatus || false,
        simchas: validatedData.simchas || false,
        shiva: validatedData.shiva || false,
        newsletter: validatedData.newsletter ?? true,
        tehillim: validatedData.tehillim || false,
        communityEvents: validatedData.communityEvents || false,
        unsubscribeToken,
        isActive: true,
        // Note: Admin-added subscribers without userId won't receive emails
        // Users should register an account to receive notifications
      })
      .returning();

    return NextResponse.json(newSubscriber, { status: 201 });
  } catch (error) {
    console.error("Error creating subscriber:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid data", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create subscriber" },
      { status: 500 }
    );
  }
}
