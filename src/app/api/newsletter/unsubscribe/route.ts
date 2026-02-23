import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailSubscribers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Unsubscribe from newsletter via token
 * POST /api/newsletter/unsubscribe
 */
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    // Find subscriber by token
    const subscriber = await db
      .select()
      .from(emailSubscribers)
      .where(eq(emailSubscribers.unsubscribeToken, token))
      .then((r) => r[0]);

    if (!subscriber) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    // Mark as unsubscribed (set all subscriptions to false)
    await db
      .update(emailSubscribers)
      .set({
        newsletter: false,
        kosherAlerts: false,
        eruvStatus: false,
        simchas: false,
        shiva: false,
        tehillim: false,
        communityEvents: false,
        isActive: false,
        unsubscribedAt: new Date(),
      })
      .where(eq(emailSubscribers.id, subscriber.id));

    return NextResponse.json({
      success: true,
      message: "Successfully unsubscribed",
    });
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return NextResponse.json(
      { error: "Failed to unsubscribe" },
      { status: 500 }
    );
  }
}

/**
 * Get subscriber info for preference page
 * GET /api/newsletter/unsubscribe?token=xxx
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  try {
    const subscriber = await db
      .select({
        id: emailSubscribers.id,
        email: emailSubscribers.email,
        firstName: emailSubscribers.firstName,
        newsletter: emailSubscribers.newsletter,
        kosherAlerts: emailSubscribers.kosherAlerts,
        eruvStatus: emailSubscribers.eruvStatus,
        simchas: emailSubscribers.simchas,
        shiva: emailSubscribers.shiva,
        tehillim: emailSubscribers.tehillim,
        communityEvents: emailSubscribers.communityEvents,
        isActive: emailSubscribers.isActive,
        unsubscribedAt: emailSubscribers.unsubscribedAt,
      })
      .from(emailSubscribers)
      .where(eq(emailSubscribers.unsubscribeToken, token))
      .then((r) => r[0]);

    if (!subscriber) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    return NextResponse.json(subscriber);
  } catch (error) {
    console.error("Get subscriber error:", error);
    return NextResponse.json(
      { error: "Failed to get subscriber" },
      { status: 500 }
    );
  }
}

/**
 * Update subscriber preferences
 * PUT /api/newsletter/unsubscribe
 */
export async function PUT(req: NextRequest) {
  try {
    const { token, preferences } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    // Find subscriber by token
    const subscriber = await db
      .select()
      .from(emailSubscribers)
      .where(eq(emailSubscribers.unsubscribeToken, token))
      .then((r) => r[0]);

    if (!subscriber) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    // Check if at least one subscription is active
    const hasActiveSubscription =
      preferences.newsletter ||
      preferences.kosherAlerts ||
      preferences.eruvStatus ||
      preferences.simchas ||
      preferences.shiva ||
      preferences.tehillim ||
      preferences.communityEvents;

    // Update preferences
    await db
      .update(emailSubscribers)
      .set({
        newsletter: preferences.newsletter ?? false,
        kosherAlerts: preferences.kosherAlerts ?? false,
        eruvStatus: preferences.eruvStatus ?? false,
        simchas: preferences.simchas ?? false,
        shiva: preferences.shiva ?? false,
        tehillim: preferences.tehillim ?? false,
        communityEvents: preferences.communityEvents ?? false,
        isActive: hasActiveSubscription,
        unsubscribedAt: hasActiveSubscription ? null : new Date(),
      })
      .where(eq(emailSubscribers.id, subscriber.id));

    return NextResponse.json({
      success: true,
      message: "Preferences updated",
    });
  } catch (error) {
    console.error("Update preferences error:", error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}
