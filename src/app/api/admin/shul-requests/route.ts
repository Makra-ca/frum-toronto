import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shulRegistrationRequests, users, shuls } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// GET all shul registration requests
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";

    const requests = await db
      .select({
        id: shulRegistrationRequests.id,
        message: shulRegistrationRequests.message,
        status: shulRegistrationRequests.status,
        createdAt: shulRegistrationRequests.createdAt,
        reviewedAt: shulRegistrationRequests.reviewedAt,
        reviewNotes: shulRegistrationRequests.reviewNotes,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
        shul: {
          id: shuls.id,
          name: shuls.name,
        },
        shulName: shuls.name,
      })
      .from(shulRegistrationRequests)
      .leftJoin(users, eq(shulRegistrationRequests.userId, users.id))
      .leftJoin(shuls, eq(shulRegistrationRequests.shulId, shuls.id))
      .where(eq(shulRegistrationRequests.status, status))
      .orderBy(desc(shulRegistrationRequests.createdAt));

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Failed to fetch shul requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch shul requests" },
      { status: 500 }
    );
  }
}
