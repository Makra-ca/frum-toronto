import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    await db
      .update(businesses)
      .set({
        approvalStatus: "rejected",
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, parseInt(id)));

    return NextResponse.json({ message: "Business rejected" });
  } catch (error) {
    console.error("Failed to reject business:", error);
    return NextResponse.json(
      { error: "Failed to reject business" },
      { status: 500 }
    );
  }
}
