import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { simchas, classifieds, events, tehillimList } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const tableMap = {
  simchas,
  classifieds,
  events,
  tehillim: tehillimList,
} as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { type, id } = await params;

    const table = tableMap[type as keyof typeof tableMap];
    if (!table) {
      return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
    }

    await db
      .update(table)
      .set({
        approvalStatus: "rejected",
      })
      .where(eq(table.id, parseInt(id)));

    return NextResponse.json({ message: `${type} rejected` });
  } catch (error) {
    console.error("Failed to reject content:", error);
    return NextResponse.json(
      { error: "Failed to reject content" },
      { status: 500 }
    );
  }
}
