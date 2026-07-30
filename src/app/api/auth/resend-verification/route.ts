import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { users, verificationTokens } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";
import crypto from "crypto";
import { sendVerificationEmail } from "@/lib/email/send";

/**
 * Sends a fresh verification email to the signed-in user.
 *
 * This route exists because submissions are now gated on `email_verified`, and
 * the verification email was previously sent exactly once — at registration.
 * Anyone who lost it had no way to verify, so gating without this would strand
 * them permanently.
 *
 * Requires a session rather than taking an email in the body: an open endpoint
 * that mails an arbitrary address is a spam relay.
 */

/** Minimum gap between sends, so the button cannot be used to hammer someone's inbox. */
const RESEND_COOLDOWN_MS = 2 * 60 * 1000;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);
    if (!Number.isSafeInteger(userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        emailVerified: users.emailVerified,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.isActive === false) {
      return NextResponse.json(
        { error: "This account has been disabled. Please contact us." },
        { status: 403 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json({
        message: "Your email address is already verified.",
        alreadyVerified: true,
      });
    }

    // Rate limit by looking at the freshest existing token: if one was issued
    // very recently, don't send another.
    const [recent] = await db
      .select({ expires: verificationTokens.expires })
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, user.email),
          gt(verificationTokens.expires, new Date(Date.now() + TOKEN_TTL_MS - RESEND_COOLDOWN_MS))
        )
      )
      .limit(1);

    if (recent) {
      return NextResponse.json(
        {
          error:
            "A verification email was just sent. Please check your inbox, and try again in a couple of minutes if it hasn't arrived.",
        },
        { status: 429 }
      );
    }

    // Replace any outstanding tokens so only the newest link works.
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.identifier, user.email));

    const token = crypto.randomBytes(32).toString("hex");
    await db.insert(verificationTokens).values({
      identifier: user.email,
      token,
      expires: new Date(Date.now() + TOKEN_TTL_MS),
    });

    // Awaited: on serverless the function can terminate as soon as the response
    // is sent, so an un-awaited send may never happen.
    const sent = await sendVerificationEmail(user.email, token);
    if (!sent) {
      return NextResponse.json(
        { error: "We couldn't send the email just now. Please try again shortly." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      message: `Verification email sent to ${user.email}.`,
    });
  } catch (error) {
    console.error("[AUTH] Failed to resend verification email:", error);
    return NextResponse.json(
      { error: "Failed to send verification email" },
      { status: 500 }
    );
  }
}
