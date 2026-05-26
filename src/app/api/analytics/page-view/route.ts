import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { pageViews } from "@/lib/db/schema";
import { and, eq, gte } from "drizzle-orm";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "ft_session_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const DEDUP_WINDOW_HOURS = 24;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, entityType, entityId, sessionId: clientSessionId } = body;

    if (!url) {
      // Still return 200 — analytics must never fail visibly
      return NextResponse.json({ recorded: false });
    }

    // Resolve session ID from cookie (server-set, HttpOnly) — more reliable than client-sent
    const existingSessionId = request.cookies.get(COOKIE_NAME)?.value;
    const sessionId = existingSessionId ?? clientSessionId ?? crypto.randomUUID();
    const isNewSession = !existingSessionId;

    // Get authenticated user if present
    const session = await auth();
    const userId = session?.user?.id ? parseInt(session.user.id) : null;

    // Extract IP from Vercel's forwarded header
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const userAgent = request.headers.get("user-agent") ?? undefined;
    const referrer = request.headers.get("referer") ?? undefined;

    // Deduplication: for entity pages, skip if same user/session already viewed in last 24h
    const parsedEntityId = entityId ? parseInt(String(entityId)) : null;

    if (entityType && parsedEntityId) {
      const cutoff = new Date(Date.now() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000);

      const conditions = [
        eq(pageViews.entityType, entityType),
        eq(pageViews.entityId, parsedEntityId),
        gte(pageViews.viewedAt, cutoff),
      ];

      if (userId) {
        conditions.push(eq(pageViews.userId, userId));
      } else {
        conditions.push(eq(pageViews.sessionId, sessionId));
      }

      const [existing] = await db
        .select({ id: pageViews.id })
        .from(pageViews)
        .where(and(...conditions))
        .limit(1);

      if (existing) {
        const response = NextResponse.json({ recorded: false });
        if (isNewSession) {
          setSessionCookie(response, sessionId);
        }
        return response;
      }
    }

    await db.insert(pageViews).values({
      url,
      entityType: entityType ?? null,
      entityId: parsedEntityId,
      userId,
      sessionId,
      ipAddress: ip,
      userAgent,
      referrer,
    });

    const response = NextResponse.json({ recorded: true });
    if (isNewSession) {
      setSessionCookie(response, sessionId);
    }
    return response;
  } catch (error) {
    console.error("[Analytics] page-view error:", error);
    // Never expose errors to the client
    return NextResponse.json({ recorded: false });
  }
}

function setSessionCookie(response: NextResponse, sessionId: string) {
  response.cookies.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}
