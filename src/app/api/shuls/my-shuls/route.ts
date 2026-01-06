import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { userShuls, shuls } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET user's assigned shuls
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);

    // For admins, return all shuls
    if (session.user.role === "admin") {
      const allShuls = await db
        .select()
        .from(shuls)
        .where(eq(shuls.isActive, true));

      return NextResponse.json(allShuls);
    }

    // For shul managers, return only their assigned shuls
    if (session.user.role !== "shul") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const myShuls = await db
      .select({
        id: shuls.id,
        name: shuls.name,
        slug: shuls.slug,
        description: shuls.description,
        address: shuls.address,
        city: shuls.city,
        postalCode: shuls.postalCode,
        phone: shuls.phone,
        email: shuls.email,
        website: shuls.website,
        rabbi: shuls.rabbi,
        denomination: shuls.denomination,
        nusach: shuls.nusach,
        hasMinyan: shuls.hasMinyan,
        assignedAt: userShuls.assignedAt,
      })
      .from(userShuls)
      .innerJoin(shuls, eq(userShuls.shulId, shuls.id))
      .where(eq(userShuls.userId, userId));

    return NextResponse.json(myShuls);
  } catch (error) {
    console.error("Failed to fetch user's shuls:", error);
    return NextResponse.json(
      { error: "Failed to fetch shuls" },
      { status: 500 }
    );
  }
}
