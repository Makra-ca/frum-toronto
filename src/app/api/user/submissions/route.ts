import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

/**
 * Everything the signed-in user has submitted, across content types.
 *
 * POC scope: events only. The response shape is deliberately type-agnostic so
 * simchas, classifieds, shiurim and the rest can be unioned in without the
 * page changing.
 */

export interface Submission {
  id: number;
  type: "event";
  typeLabel: string;
  title: string;
  detail: string | null;
  approvalStatus: string;
  createdAt: string | null;
  editHref: string | null;
  publicHref: string | null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = parseInt(session.user.id);

  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      location: events.location,
      startTime: events.startTime,
      approvalStatus: events.approvalStatus,
      createdAt: events.createdAt,
    })
    .from(events)
    .where(eq(events.userId, userId))
    .orderBy(desc(events.createdAt), desc(events.id));

  const submissions: Submission[] = rows.map((row) => ({
    id: row.id,
    type: "event",
    typeLabel: "Event",
    title: row.title,
    // Sent as an ISO instant; the page formats it in Toronto time.
    detail: row.startTime ? row.startTime.toISOString() : null,
    approvalStatus: row.approvalStatus ?? "pending",
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    editHref: `/dashboard/submissions/events/${row.id}/edit`,
    publicHref:
      row.approvalStatus === "approved"
        ? `/community/calendar/${row.id}`
        : null,
  }));

  return NextResponse.json({ submissions });
}
