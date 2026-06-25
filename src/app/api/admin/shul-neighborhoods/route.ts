import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shulNeighborhoods } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  displayOrder: z.number().int().optional(),
});

// GET - all neighborhoods (admin, incl. inactive)
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const rows = await db
      .select()
      .from(shulNeighborhoods)
      .orderBy(asc(shulNeighborhoods.displayOrder), asc(shulNeighborhoods.name));
    return NextResponse.json(rows);
  } catch (error) {
    console.error("[ADMIN] Error fetching neighborhoods:", error);
    return NextResponse.json({ error: "Failed to fetch neighborhoods" }, { status: 500 });
  }
}

// POST - add a neighborhood
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const result = createSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const [created] = await db
      .insert(shulNeighborhoods)
      .values({
        name: result.data.name,
        displayOrder: result.data.displayOrder ?? 0,
      })
      .onConflictDoNothing()
      .returning();

    if (!created) {
      return NextResponse.json({ error: "That neighborhood already exists" }, { status: 409 });
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[ADMIN] Error creating neighborhood:", error);
    return NextResponse.json({ error: "Failed to create neighborhood" }, { status: 500 });
  }
}
