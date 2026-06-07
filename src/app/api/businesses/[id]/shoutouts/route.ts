import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import {
  businesses,
  businessShoutouts,
  subscriptionPlans,
  businessSubscriptions,
} from "@/lib/db/schema";
import { eq, and, or, desc, gte } from "drizzle-orm";
import { HDate } from "@hebcal/core";
import { notifyAdminOfSubmission } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * Check if a date falls on Shabbat (Friday or Saturday).
 */
function isShabbat(date: Date): boolean {
  const day = date.getDay(); // 0=Sun, 5=Fri, 6=Sat
  return day === 5 || day === 6;
}

/**
 * Check if a date falls on a major Chag using @hebcal/core.
 * Checks: Rosh Hashana (1-2 Tishrei), Yom Kippur (10 Tishrei),
 * Sukkot (15-22 Tishrei), Pesach (15-22 Nisan), Shavuot (6-7 Sivan).
 */
function isChag(date: Date): boolean {
  const hdate = new HDate(date);
  const month = hdate.getMonth();
  const day = hdate.getDay();

  // Tishrei (month 7)
  if (month === 7) {
    if (day === 1 || day === 2) return true; // Rosh Hashana
    if (day === 10) return true; // Yom Kippur
    if (day >= 15 && day <= 22) return true; // Sukkot + Shemini Atzeret/Simchat Torah
  }

  // Nisan (month 1)
  if (month === 1) {
    if (day >= 15 && day <= 22) return true; // Pesach
  }

  // Sivan (month 3)
  if (month === 3) {
    if (day === 6 || day === 7) return true; // Shavuot
  }

  return false;
}

// GET /api/businesses/[id]/shoutouts - List shoutouts for a business (owner only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const businessId = parseInt(id);

    if (isNaN(businessId)) {
      return NextResponse.json({ error: "Invalid business ID" }, { status: 400 });
    }

    const userId = parseInt(session.user.id);
    const isAdmin = session.user.role === "admin";

    // Verify ownership
    const [business] = await db
      .select({ id: businesses.id, userId: businesses.userId })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    if (!isAdmin && business.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const shoutouts = await db
      .select()
      .from(businessShoutouts)
      .where(eq(businessShoutouts.businessId, businessId))
      .orderBy(desc(businessShoutouts.scheduledDate));

    return NextResponse.json({ data: shoutouts });
  } catch (error) {
    console.error("[Shoutouts GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch shoutouts" },
      { status: 500 }
    );
  }
}

// POST /api/businesses/[id]/shoutouts - Submit a newsletter shoutout
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const businessId = parseInt(id);

    if (isNaN(businessId)) {
      return NextResponse.json({ error: "Invalid business ID" }, { status: 400 });
    }

    const userId = parseInt(session.user.id);
    const isAdmin = session.user.role === "admin";

    // Fetch business with subscription plan info
    const [business] = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        userId: businesses.userId,
        subscriptionPlanId: businesses.subscriptionPlanId,
        showVideo: subscriptionPlans.showVideo, // proxy for Elite tier — Elite has showVideo=true
        planName: subscriptionPlans.name,
        planSlug: subscriptionPlans.slug,
      })
      .from(businesses)
      .leftJoin(subscriptionPlans, eq(businesses.subscriptionPlanId, subscriptionPlans.id))
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    if (!isAdmin && business.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check Elite tier (proxy: plan name contains "elite" or showVideo=true)
    const isElite =
      business.showVideo === true ||
      (business.planName || "").toLowerCase().includes("elite") ||
      (business.planSlug || "").toLowerCase().includes("elite");

    if (!isAdmin && !isElite) {
      return NextResponse.json(
        { error: "Newsletter shoutouts are only available to Elite plan subscribers" },
        { status: 403 }
      );
    }

    // Additionally check if subscription is yearly (Elite yearly only)
    // For now, check that an active subscription exists — billing cycle check can be added later
    const [activeSub] = await db
      .select({ billingCycle: businessSubscriptions.billingCycle })
      .from(businessSubscriptions)
      .where(
        and(
          eq(businessSubscriptions.businessId, businessId),
          eq(businessSubscriptions.status, "active")
        )
      )
      .limit(1);

    // If not admin and no active subscription, block
    if (!isAdmin && !activeSub) {
      return NextResponse.json(
        { error: "An active subscription is required to submit a shoutout" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { scheduledDate, contentHtml, contentJson, imageUrl } = body;

    if (!scheduledDate || typeof scheduledDate !== "string") {
      return NextResponse.json({ error: "scheduledDate is required" }, { status: 400 });
    }
    if (!contentHtml || typeof contentHtml !== "string") {
      return NextResponse.json({ error: "contentHtml is required" }, { status: 400 });
    }

    // Parse and validate the scheduled date
    const parsedDate = new Date(scheduledDate + "T00:00:00");
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Invalid scheduledDate format" }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (parsedDate <= today) {
      return NextResponse.json(
        { error: "Scheduled date must be in the future" },
        { status: 400 }
      );
    }

    if (isShabbat(parsedDate)) {
      return NextResponse.json(
        { error: "Shoutouts cannot be scheduled on Shabbat (Friday or Saturday)" },
        { status: 400 }
      );
    }

    if (isChag(parsedDate)) {
      return NextResponse.json(
        { error: "Shoutouts cannot be scheduled on major Jewish holidays" },
        { status: 400 }
      );
    }

    // Check for existing active shoutout (pending_approval or approved)
    const [activeShoutout] = await db
      .select({ id: businessShoutouts.id, status: businessShoutouts.status })
      .from(businessShoutouts)
      .where(
        and(
          eq(businessShoutouts.businessId, businessId),
          or(
            eq(businessShoutouts.status, "pending_approval"),
            eq(businessShoutouts.status, "approved")
          )
        )
      )
      .limit(1);

    if (activeShoutout) {
      return NextResponse.json(
        {
          error: `You already have a shoutout with status "${activeShoutout.status}". Only one active shoutout is allowed at a time.`,
        },
        { status: 400 }
      );
    }

    // Check 365-day cooldown from last sent shoutout's scheduled date
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const [recentSent] = await db
      .select({ scheduledDate: businessShoutouts.scheduledDate })
      .from(businessShoutouts)
      .where(
        and(
          eq(businessShoutouts.businessId, businessId),
          eq(businessShoutouts.status, "sent"),
          gte(businessShoutouts.scheduledDate, oneYearAgo.toISOString().split("T")[0])
        )
      )
      .limit(1);

    if (recentSent && !isAdmin) {
      return NextResponse.json(
        {
          error: "You have already used your shoutout within the last 365 days. You can submit a new shoutout after the cooldown period.",
        },
        { status: 400 }
      );
    }

    // Create the shoutout
    const [newShoutout] = await db
      .insert(businessShoutouts)
      .values({
        businessId,
        scheduledDate,
        contentHtml,
        contentJson: contentJson || null,
        imageUrl: imageUrl || null,
        status: "pending_approval",
        updatedAt: new Date(),
      })
      .returning();

    // Notify admins (in-app + instant email to shoutout recipients)
    await notifyAdminOfSubmission({
      contentType: "shoutout",
      title: `Newsletter shoutout submitted for review — ${business.name}`,
      body:
        `Business: ${business.name}\n` +
        `Scheduled Date: ${scheduledDate}\n` +
        `Submitted by: ${session.user.name || session.user.email || "Unknown user"}`,
      linkUrl: "/admin/businesses/shoutouts",
      status: "pending",
    });

    return NextResponse.json(newShoutout, { status: 201 });
  } catch (error) {
    console.error("[Shoutouts POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to submit shoutout" },
      { status: 500 }
    );
  }
}
