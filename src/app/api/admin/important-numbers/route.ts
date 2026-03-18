import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { importantNumbers } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

// GET - List all important numbers
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const numbers = await db
      .select()
      .from(importantNumbers)
      .orderBy(asc(importantNumbers.displayOrder), asc(importantNumbers.name));

    return NextResponse.json({ numbers });
  } catch (error) {
    console.error("[API] Error fetching important numbers:", error);
    return NextResponse.json({ error: "Failed to fetch important numbers" }, { status: 500 });
  }
}

// POST - Create a new important number
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ error: "Phone is required" }, { status: 400 });
    }

    const [created] = await db
      .insert(importantNumbers)
      .values({
        name,
        phone,
        category: typeof body.category === "string" ? body.category.trim() || null : null,
        description: typeof body.description === "string" ? body.description.trim() || null : null,
        isEmergency: body.isEmergency === true,
        displayOrder: typeof body.displayOrder === "number" ? body.displayOrder : 0,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating important number:", error);
    return NextResponse.json({ error: "Failed to create important number" }, { status: 500 });
  }
}
