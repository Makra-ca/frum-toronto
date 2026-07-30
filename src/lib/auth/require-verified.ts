import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Machine-readable reason, so the UI can offer "resend verification email"
 * rather than showing a generic failure. Deliberately absent from the
 * account-disabled response, which no resend can fix.
 */
export const EMAIL_UNVERIFIED_CODE = "email_unverified";

/**
 * Guards a submission endpoint: the account must be active and its email
 * verified. Returns a response to send if posting is not allowed, or null to
 * carry on.
 *
 * Deliberately does NOT import `auth`. Callers have already resolved the session
 * and pass `session.user.id`, which avoids a second JWT verification per request
 * and — just as usefully — keeps this module importable in tests without
 * dragging next-auth into a non-Next environment.
 *
 *   const session = await auth();
 *   if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 *   const notAllowed = await assertCanPost(session.user.id);
 *   if (notAllowed) return notAllowed;
 *
 * Verification is read from the database rather than the session token on
 * purpose. `emailVerified` is not in the JWT, and putting it there would go
 * stale: someone who verifies mid-session would keep being refused until their
 * token refreshed — exactly the dead end this gate must not create.
 *
 * Admins are exempt. An admin acting through the public APIs should not be
 * blocked by their own account's verification state.
 */
export async function assertCanPost(
  sessionUserId: string | number | undefined | null
): Promise<NextResponse | null> {
  const userId = Number(sessionUserId);
  // Number(null) is 0 and Number("") is 0, so the integer check has to reject
  // those too — hence the explicit > 0.
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [row] = await db
    .select({
      role: users.role,
      emailVerified: users.emailVerified,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // A session can outlive a block, so this is re-checked at write time rather
  // than trusted from sign-in.
  if (row.isActive === false) {
    return NextResponse.json(
      { error: "This account has been disabled. Please contact us." },
      { status: 403 }
    );
  }

  if (row.role !== "admin" && !row.emailVerified) {
    return NextResponse.json(
      {
        error:
          "Please verify your email address before posting. Check your inbox for the verification link, or request a new one from your dashboard.",
        code: EMAIL_UNVERIFIED_CODE,
      },
      { status: 403 }
    );
  }

  return null;
}
