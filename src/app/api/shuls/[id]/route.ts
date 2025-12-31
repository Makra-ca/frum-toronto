import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shuls, businesses, daveningSchedules } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { canUserManageShul } from "@/lib/auth/permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET shul details (for shul managers)
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const shulId = parseInt(id);
    const userId = parseInt(session.user.id);

    // Check permissions
    const canManage = await canUserManageShul(userId, shulId, session.user.role);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get shul with business details
    const [shul] = await db
      .select({
        id: shuls.id,
        businessId: shuls.businessId,
        rabbi: shuls.rabbi,
        denomination: shuls.denomination,
        nusach: shuls.nusach,
        hasMinyan: shuls.hasMinyan,
        business: {
          id: businesses.id,
          name: businesses.name,
          slug: businesses.slug,
          description: businesses.description,
          address: businesses.address,
          city: businesses.city,
          postalCode: businesses.postalCode,
          phone: businesses.phone,
          email: businesses.email,
          website: businesses.website,
          logoUrl: businesses.logoUrl,
          hours: businesses.hours,
          socialLinks: businesses.socialLinks,
        },
      })
      .from(shuls)
      .leftJoin(businesses, eq(shuls.businessId, businesses.id))
      .where(eq(shuls.id, shulId))
      .limit(1);

    if (!shul) {
      return NextResponse.json({ error: "Shul not found" }, { status: 404 });
    }

    // Get davening schedules
    const schedules = await db
      .select()
      .from(daveningSchedules)
      .where(eq(daveningSchedules.shulId, shulId));

    return NextResponse.json({ ...shul, daveningSchedules: schedules });
  } catch (error) {
    console.error("Failed to fetch shul:", error);
    return NextResponse.json(
      { error: "Failed to fetch shul" },
      { status: 500 }
    );
  }
}

// PUT update shul (for shul managers)
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const shulId = parseInt(id);
    const userId = parseInt(session.user.id);

    // Check permissions
    const canManage = await canUserManageShul(userId, shulId, session.user.role);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { shulData, businessData } = body;

    // Update shul
    if (shulData) {
      await db
        .update(shuls)
        .set({
          rabbi: shulData.rabbi,
          denomination: shulData.denomination,
          nusach: shulData.nusach,
          hasMinyan: shulData.hasMinyan,
        })
        .where(eq(shuls.id, shulId));
    }

    // Update business if provided
    if (businessData) {
      // First get the shul to find businessId
      const [shul] = await db
        .select({ businessId: shuls.businessId })
        .from(shuls)
        .where(eq(shuls.id, shulId))
        .limit(1);

      if (shul?.businessId) {
        await db
          .update(businesses)
          .set({
            name: businessData.name,
            description: businessData.description,
            address: businessData.address,
            city: businessData.city,
            postalCode: businessData.postalCode,
            phone: businessData.phone,
            email: businessData.email,
            website: businessData.website,
            hours: businessData.hours,
            socialLinks: businessData.socialLinks,
            updatedAt: new Date(),
          })
          .where(eq(businesses.id, shul.businessId));
      }
    }

    return NextResponse.json({ message: "Shul updated successfully" });
  } catch (error) {
    console.error("Failed to update shul:", error);
    return NextResponse.json(
      { error: "Failed to update shul" },
      { status: 500 }
    );
  }
}
