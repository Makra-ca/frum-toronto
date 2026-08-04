import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { shouldAutoGrantShulRequest } from "@/lib/permissions/auto-approve-targets";
import { shulRegistrationRequests, userShuls, shuls, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { notifyAdminOfSubmission } from "@/lib/notifications";
import { assertCanPost } from "@/lib/auth/require-verified";

// POST - create a request to manage a shul
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Submissions require a verified email address (admins exempt). Also
    // re-checks the account is not disabled, since a session can outlive a block.
    const notAllowed = await assertCanPost(session?.user?.id);
    if (notAllowed) return notAllowed;

    const userId = parseInt(session.user.id);
    const body = await request.json();
    const { shulId, message } = body;

    if (!shulId) {
      return NextResponse.json(
        { error: "shulId is required" },
        { status: 400 }
      );
    }

    // Check if user already has an assignment for this shul
    const existingAssignment = await db
      .select()
      .from(userShuls)
      .where(and(eq(userShuls.userId, userId), eq(userShuls.shulId, shulId)))
      .limit(1);

    if (existingAssignment.length > 0) {
      return NextResponse.json(
        { error: "You already have access to manage this shul" },
        { status: 400 }
      );
    }

    // Check if there's already a pending request
    const existingRequest = await db
      .select()
      .from(shulRegistrationRequests)
      .where(
        and(
          eq(shulRegistrationRequests.userId, userId),
          eq(shulRegistrationRequests.shulId, shulId),
          eq(shulRegistrationRequests.status, "pending")
        )
      )
      .limit(1);

    if (existingRequest.length > 0) {
      return NextResponse.json(
        { error: "You already have a pending request for this shul" },
        { status: 400 }
      );
    }

    // canAutoApproveShuls grants the request outright. Note what that hands
    // over: not permission to submit something for review, but control of a
    // shul's public listing — name, address, rabbi, davening times, documents —
    // all of which go live without approval once assigned.
    const [requester] = await db
      .select({ canAutoApproveShuls: users.canAutoApproveShuls })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const autoGrant = shouldAutoGrantShulRequest({
      canAutoApproveShuls: requester?.canAutoApproveShuls,
    });

    const [newRequest] = await db
      .insert(shulRegistrationRequests)
      .values({
        userId,
        shulId,
        message: message || null,
        status: autoGrant ? "approved" : "pending",
      })
      .returning();

    if (autoGrant) {
      // Mirror the admin approval path exactly (admin/shul-requests/[id]):
      // create the assignment, then promote a plain member so the dashboard
      // link appears. Only "member" — never overwrite an existing role.
      await db.insert(userShuls).values({
        userId,
        shulId,
        assignedBy: userId,
      });

      await db
        .update(users)
        .set({ role: "shul", updatedAt: new Date() })
        .where(and(eq(users.id, userId), eq(users.role, "member")));
    }

    // Notify admins (in-app + instant email to shul_registration recipients)
    // Name lookup is notification prep only — never let it fail the submission
    let shulName: string | null = null;
    try {
      const [shul] = await db
        .select({ name: shuls.name })
        .from(shuls)
        .where(eq(shuls.id, shulId))
        .limit(1);
      shulName = shul?.name ?? null;
    } catch (error) {
      console.error("[NOTIFY] Failed to look up shul name:", error);
    }

    await notifyAdminOfSubmission({
      contentType: "shul_request",
      title: autoGrant
        ? `Shul management granted automatically: ${shulName || `Shul #${shulId}`}`
        : `New shul management request: ${shulName || `Shul #${shulId}`}`,
      body:
        `Shul: ${shulName || `#${shulId}`}\n` +
        `Requested by: ${session.user.name || session.user.email || "Unknown user"}` +
        (message ? `\n\nMessage: ${message}` : ""),
      linkUrl: autoGrant ? "/admin/shuls/managers" : "/admin/shuls/requests",
      status: autoGrant ? "auto_approved" : "pending",
    });

    return NextResponse.json(newRequest, { status: 201 });
  } catch (error) {
    console.error("Failed to create shul request:", error);
    return NextResponse.json(
      { error: "Failed to create request" },
      { status: 500 }
    );
  }
}

// GET - get user's own requests
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);

    const requests = await db
      .select()
      .from(shulRegistrationRequests)
      .where(eq(shulRegistrationRequests.userId, userId));

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Failed to fetch user's requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 }
    );
  }
}
