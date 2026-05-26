import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { classifiedContactLog } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const classifiedId = parseInt(id);

    if (isNaN(classifiedId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const logs = await db
      .select({
        id: classifiedContactLog.id,
        senderName: classifiedContactLog.senderName,
        senderEmail: classifiedContactLog.senderEmail,
        message: classifiedContactLog.message,
        ipAddress: classifiedContactLog.ipAddress,
        sentAt: classifiedContactLog.sentAt,
      })
      .from(classifiedContactLog)
      .where(eq(classifiedContactLog.classifiedId, classifiedId))
      .orderBy(desc(classifiedContactLog.sentAt))
      .limit(50);

    return NextResponse.json(logs);
  } catch (error) {
    console.error("[API] Error fetching classified contact log:", error);
    return NextResponse.json({ error: "Failed to fetch contact log" }, { status: 500 });
  }
}
