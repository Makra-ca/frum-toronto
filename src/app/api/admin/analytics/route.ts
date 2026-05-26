import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getAnalyticsData } from "@/lib/analytics/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const { dateFrom, dateTo } = resolveTimeRange(searchParams);

    const data = await getAnalyticsData(dateFrom, dateTo);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[Admin Analytics] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}

function resolveTimeRange(searchParams: URLSearchParams): {
  dateFrom: Date;
  dateTo: Date;
} {
  const from = searchParams.get("startDate") || searchParams.get("from");
  const to = searchParams.get("endDate") || searchParams.get("to");

  if (from && to) {
    return {
      dateFrom: new Date(from),
      dateTo: new Date(to + "T23:59:59"),
    };
  }

  const daysParam = searchParams.get("days");
  const days = daysParam ? parseInt(daysParam) : 30;

  const dateTo = new Date();
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - (isNaN(days) ? 30 : days));

  return { dateFrom, dateTo };
}
