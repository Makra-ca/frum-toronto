import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getPusherServer, ADMIN_NOTIFICATIONS_CHANNEL } from "@/lib/pusher";

export const dynamic = "force-dynamic";

// POST /api/pusher/auth — authorize subscriptions to the private admin channel.
// NOT covered by the middleware matcher (/admin/:path*, /dashboard/:path*),
// so auth() MUST be called explicitly here.
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pusher = getPusherServer();
    if (!pusher) {
      return NextResponse.json(
        { error: "Real-time notifications are not configured" },
        { status: 503 }
      );
    }

    // pusher-js posts application/x-www-form-urlencoded
    const formData = await request.formData();
    const socketId = formData.get("socket_id");
    const channelName = formData.get("channel_name");

    if (typeof socketId !== "string" || typeof channelName !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Only the admin notifications channel may be authorized here
    if (channelName !== ADMIN_NOTIFICATIONS_CHANNEL) {
      return NextResponse.json({ error: "Forbidden channel" }, { status: 403 });
    }

    const authResponse = pusher.authorizeChannel(socketId, channelName);
    return NextResponse.json(authResponse);
  } catch (error) {
    console.error("[PUSHER] Auth endpoint error:", error);
    return NextResponse.json({ error: "Authorization failed" }, { status: 500 });
  }
}
