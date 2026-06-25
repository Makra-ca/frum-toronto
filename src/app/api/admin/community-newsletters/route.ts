import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { communityNewsletters } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(255),
  publisher: z.string().trim().max(200).optional().nullable(),
  fileUrl: z.string().url("Valid file URL is required"),
  fileSize: z.number().int().optional().nullable(),
  description: z.string().trim().optional().nullable(),
});

// GET - all community newsletters (admin)
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await db
      .select()
      .from(communityNewsletters)
      .orderBy(desc(communityNewsletters.publishedAt));
    return NextResponse.json(rows);
  } catch (error) {
    console.error("[ADMIN] Error fetching community newsletters:", error);
    return NextResponse.json({ error: "Failed to fetch newsletters" }, { status: 500 });
  }
}

// POST - create a community newsletter
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
      .insert(communityNewsletters)
      .values({
        title: result.data.title,
        publisher: result.data.publisher?.trim() || null,
        fileUrl: result.data.fileUrl,
        fileSize: result.data.fileSize ?? null,
        description: result.data.description?.trim() || null,
        uploadedBy: parseInt(session.user.id),
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[ADMIN] Error creating community newsletter:", error);
    return NextResponse.json({ error: "Failed to create newsletter" }, { status: 500 });
  }
}
