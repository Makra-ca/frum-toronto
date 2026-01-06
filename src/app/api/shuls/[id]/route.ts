import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shuls, daveningSchedules } from "@/lib/db/schema";
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

    // Get shul
    const [shul] = await db
      .select()
      .from(shuls)
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

    // Update shul directly (no more business table)
    await db
      .update(shuls)
      .set({
        name: body.name,
        description: body.description,
        address: body.address,
        city: body.city,
        postalCode: body.postalCode,
        phone: body.phone,
        email: body.email,
        website: body.website,
        rabbi: body.rabbi,
        denomination: body.denomination,
        nusach: body.nusach,
        hasMinyan: body.hasMinyan,
        updatedAt: new Date(),
      })
      .where(eq(shuls.id, shulId));

    return NextResponse.json({ message: "Shul updated successfully" });
  } catch (error) {
    console.error("Failed to update shul:", error);
    return NextResponse.json(
      { error: "Failed to update shul" },
      { status: 500 }
    );
  }
}
