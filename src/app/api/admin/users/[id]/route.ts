import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { role, isTrusted, isActive, emailVerified } = body;

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (role !== undefined) updateData.role = role;
    if (isTrusted !== undefined) updateData.isTrusted = isTrusted;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (emailVerified !== undefined) {
      updateData.emailVerified = emailVerified ? new Date() : null;
    }

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, parseInt(id)));

    return NextResponse.json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}
