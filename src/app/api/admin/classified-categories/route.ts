import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { classifiedCategories } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

// GET - List all classified categories
export async function GET() {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const categories = await db
      .select()
      .from(classifiedCategories)
      .orderBy(asc(classifiedCategories.displayOrder), asc(classifiedCategories.name));

    return NextResponse.json(categories);
  } catch (error) {
    console.error("[API] Error fetching classified categories:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}
