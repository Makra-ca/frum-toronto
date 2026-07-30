import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { homepageAds } from "@/lib/db/schema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Records a click on an ad.
 *
 * Called via `navigator.sendBeacon`, which fires and forgets — the browser sends
 * it without waiting, so a slow write can never delay the visitor's navigation.
 * That also means the response body is never read, hence the bare 204.
 *
 * Deliberately unauthenticated: clicks come from anonymous visitors. The only
 * thing a caller can do is inflate a counter on an ad that already exists, which
 * is why nothing downstream treats `click_count` as trustworthy enough to bill
 * from. Impressions are not tracked at all — that would mean a write on every
 * homepage render.
 *
 * The increment is done in SQL rather than read-modify-write so two concurrent
 * clicks cannot lose one another.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const adId = parseInt(id, 10);

    if (!Number.isInteger(adId) || adId <= 0) {
      return new NextResponse(null, { status: 400 });
    }

    await db
      .update(homepageAds)
      .set({ clickCount: sql`${homepageAds.clickCount} + 1` })
      .where(eq(homepageAds.id, adId));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    // A failed click count must never surface to the visitor — they are already
    // navigating away.
    console.error("[ADS] Failed to record click:", error);
    return new NextResponse(null, { status: 204 });
  }
}
