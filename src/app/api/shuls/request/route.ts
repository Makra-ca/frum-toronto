import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shulRegistrationRequests, userShuls } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

// POST - create a request to manage a shul
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const body = await request.json();
    const { shulId, message } = body;

    if (!shulId) {
      return NextResponse.json(
        { error: "shulId is required" },
        { status: 400 }
      );
    }

    // Check if user already has an assignment for this shul
    const existingAssignment = await db
      .select()
      .from(userShuls)
      .where(and(eq(userShuls.userId, userId), eq(userShuls.shulId, shulId)))
      .limit(1);

    if (existingAssignment.length > 0) {
      return NextResponse.json(
        { error: "You already have access to manage this shul" },
        { status: 400 }
      );
    }

    // Check if there's already a pending request
    const existingRequest = await db
      .select()
      .from(shulRegistrationRequests)
      .where(
        and(
          eq(shulRegistrationRequests.userId, userId),
          eq(shulRegistrationRequests.shulId, shulId),
          eq(shulRegistrationRequests.status, "pending")
        )
      )
      .limit(1);

    if (existingRequest.length > 0) {
      return NextResponse.json(
        { error: "You already have a pending request for this shul" },
        { status: 400 }
      );
    }

    // Create the request
    const [newRequest] = await db
      .insert(shulRegistrationRequests)
      .values({
        userId,
        shulId,
        message: message || null,
        status: "pending",
      })
      .returning();

    return NextResponse.json(newRequest, { status: 201 });
  } catch (error) {
    console.error("Failed to create shul request:", error);
    return NextResponse.json(
      { error: "Failed to create request" },
      { status: 500 }
    );
  }
}

// GET - get user's own requests
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);

    const requests = await db
      .select()
      .from(shulRegistrationRequests)
      .where(eq(shulRegistrationRequests.userId, userId));

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Failed to fetch user's requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 }
    );
  }
}
