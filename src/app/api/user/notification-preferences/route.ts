import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { emailSubscribers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

const updateSchema = z.object({
  newsletter: z.boolean().optional(),
  simchas: z.boolean().optional(),
  shiva: z.boolean().optional(),
  kosherAlerts: z.boolean().optional(),
  tehillim: z.boolean().optional(),
  communityEvents: z.boolean().optional(),
  communityAlerts: z.boolean().optional(),
  eruvStatus: z.boolean().optional(),
});

// GET - Get user's notification preferences
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = parseInt(session.user.id);

    const [subscriber] = await db
      .select({
        newsletter: emailSubscribers.newsletter,
        simchas: emailSubscribers.simchas,
        shiva: emailSubscribers.shiva,
        kosherAlerts: emailSubscribers.kosherAlerts,
        tehillim: emailSubscribers.tehillim,
        communityEvents: emailSubscribers.communityEvents,
        communityAlerts: emailSubscribers.communityAlerts,
        eruvStatus: emailSubscribers.eruvStatus,
      })
      .from(emailSubscribers)
      .where(eq(emailSubscribers.userId, userId))
      .limit(1);

    if (!subscriber) {
      // Return defaults if no subscriber record exists
      return NextResponse.json({
        newsletter: true,
        simchas: false,
        shiva: false,
        kosherAlerts: false,
        tehillim: false,
        communityEvents: false,
        communityAlerts: false,
        eruvStatus: false,
      });
    }

    return NextResponse.json(subscriber);
  } catch (error) {
    console.error("[API] Error fetching notification preferences:", error);
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 });
  }
}

// PATCH - Update user's notification preferences
export async function PATCH(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = parseInt(session.user.id);
    const body = await request.json();
    const result = updateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    // Check if subscriber record exists
    const [existing] = await db
      .select({ id: emailSubscribers.id })
      .from(emailSubscribers)
      .where(eq(emailSubscribers.userId, userId))
      .limit(1);

    if (existing) {
      // Update existing record
      const [updated] = await db
        .update(emailSubscribers)
        .set(result.data)
        .where(eq(emailSubscribers.userId, userId))
        .returning();

      return NextResponse.json(updated);
    } else {
      // Create new subscriber record for existing user
      const unsubscribeToken = crypto.randomBytes(32).toString("hex");

      const [created] = await db
        .insert(emailSubscribers)
        .values({
          userId,
          email: session.user.email!.toLowerCase(),
          firstName: session.user.name?.split(" ")[0] || null,
          lastName: session.user.name?.split(" ").slice(1).join(" ") || null,
          newsletter: result.data.newsletter ?? true,
          simchas: result.data.simchas ?? false,
          shiva: result.data.shiva ?? false,
          kosherAlerts: result.data.kosherAlerts ?? false,
          tehillim: result.data.tehillim ?? false,
          communityEvents: result.data.communityEvents ?? false,
          communityAlerts: result.data.communityAlerts ?? false,
          eruvStatus: result.data.eruvStatus ?? false,
          isActive: true,
          unsubscribeToken,
        })
        .returning();

      return NextResponse.json(created);
    }
  } catch (error) {
    console.error("[API] Error updating notification preferences:", error);
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}
