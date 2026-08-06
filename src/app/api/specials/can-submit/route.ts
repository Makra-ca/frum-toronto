import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, businesses } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({
        canSubmit: false,
        reason: "not_authenticated",
      });
    }

    const userId = parseInt(session.user.id);
    const [user] = await db
      .select({
        role: users.role,
        canPostSpecials: users.canPostSpecials,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const canSubmit = user?.role === "admin" || user?.canPostSpecials === true;

    if (!canSubmit) {
      return NextResponse.json({
        canSubmit: false,
        reason: "no_permission",
      });
    }

    // Businesses this user may post a special for.
    //
    // Admins see every approved listing; anyone else sees only their own. This
    // matches the ownership check in POST /api/specials — offering a business
    // the caller cannot post for would just produce a 403 at submit time.
    const ownershipFilter =
      user?.role === "admin" ? undefined : eq(businesses.userId, userId);

    const approvedBusinesses = await db
      .select({
        id: businesses.id,
        name: businesses.name,
      })
      .from(businesses)
      .where(
        and(
          eq(businesses.isActive, true),
          eq(businesses.approvalStatus, "approved"),
          ...(ownershipFilter ? [ownershipFilter] : [])
        )
      )
      .orderBy(businesses.name);

    return NextResponse.json({
      canSubmit: true,
      businesses: approvedBusinesses,
    });
  } catch (error) {
    console.error("Error checking special submission permission:", error);
    return NextResponse.json(
      { canSubmit: false, reason: "error" },
      { status: 500 }
    );
  }
}
