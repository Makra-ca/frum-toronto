import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { emailSubscribers } from "@/lib/db/schema";
import { subscriberSchema } from "@/lib/validations/newsletter";
import { eq } from "drizzle-orm";

// GET - Get single subscriber
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
    const subscriberId = parseInt(id);

    if (isNaN(subscriberId)) {
      return NextResponse.json(
        { error: "Invalid subscriber ID" },
        { status: 400 }
      );
    }

    const [subscriber] = await db
      .select()
      .from(emailSubscribers)
      .where(eq(emailSubscribers.id, subscriberId))
      .limit(1);

    if (!subscriber) {
      return NextResponse.json(
        { error: "Subscriber not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(subscriber);
  } catch (error) {
    console.error("Error fetching subscriber:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscriber" },
      { status: 500 }
    );
  }
}

// PUT - Update subscriber
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
    const subscriberId = parseInt(id);

    if (isNaN(subscriberId)) {
      return NextResponse.json(
        { error: "Invalid subscriber ID" },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(emailSubscribers)
      .where(eq(emailSubscribers.id, subscriberId))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Subscriber not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = subscriberSchema.parse(body);

    // Check if email is being changed and if new email already exists
    if (validatedData.email.toLowerCase() !== existing.email) {
      const [emailExists] = await db
        .select()
        .from(emailSubscribers)
        .where(eq(emailSubscribers.email, validatedData.email.toLowerCase()))
        .limit(1);

      if (emailExists) {
        return NextResponse.json(
          { error: "Another subscriber with this email already exists" },
          { status: 400 }
        );
      }
    }

    const [updated] = await db
      .update(emailSubscribers)
      .set({
        email: validatedData.email.toLowerCase(),
        firstName: validatedData.firstName || null,
        lastName: validatedData.lastName || null,
        kosherAlerts: validatedData.kosherAlerts || false,
        eruvStatus: validatedData.eruvStatus || false,
        simchas: validatedData.simchas || false,
        shiva: validatedData.shiva || false,
        newsletter: validatedData.newsletter ?? true,
      })
      .where(eq(emailSubscribers.id, subscriberId))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating subscriber:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid data", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update subscriber" },
      { status: 500 }
    );
  }
}

// DELETE - Delete subscriber
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
    const subscriberId = parseInt(id);

    if (isNaN(subscriberId)) {
      return NextResponse.json(
        { error: "Invalid subscriber ID" },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(emailSubscribers)
      .where(eq(emailSubscribers.id, subscriberId))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Subscriber not found" },
        { status: 404 }
      );
    }

    await db
      .delete(emailSubscribers)
      .where(eq(emailSubscribers.id, subscriberId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting subscriber:", error);
    return NextResponse.json(
      { error: "Failed to delete subscriber" },
      { status: 500 }
    );
  }
}
