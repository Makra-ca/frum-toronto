import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, passwordResetTokens, accounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { sendPasswordResetEmail } from "@/lib/email/send";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate input
    const result = forgotPasswordSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email } = result.data;

    // Always return success to prevent email enumeration
    const successResponse = NextResponse.json({
      message: "If an account exists with this email, you will receive a password reset link.",
    });

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      // Return success even if user doesn't exist
      return successResponse;
    }

    // A disabled account is this project's ban (is_active = false blocks both
    // password and Google sign-in). Sending a reset link was a dead end: the
    // person reset successfully and still could not log in, because the reset
    // does not touch is_active. Say so instead — and deliberately do NOT
    // reactivate on reset, or anyone banned could unban themselves from here.
    if (user.isActive === false) {
      return NextResponse.json(
        {
          error:
            "This account has been disabled. Please contact us and we'll be glad to help.",
        },
        { status: 403 }
      );
    }

    // No password hash has two very different causes.
    //
    // An OAuth-only account must NOT be resettable — issuing a password to it
    // would let someone who controls the inbox take over a Google-linked
    // account. That is the case this guard originally existed for.
    //
    // A legacy imported member with no password is different: there is no OAuth
    // link, and refusing left 16 of them told to "check your email" while no
    // email was ever sent. They are allowed through so a reset gives them a
    // password for the first time.
    if (!user.passwordHash) {
      const [oauthAccount] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.userId, user.id))
        .limit(1);

      if (oauthAccount) {
        return successResponse;
      }
    }

    // Delete any existing tokens for this user
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));

    // Generate new token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expires,
    });

    // Send password reset email
    await sendPasswordResetEmail(email, token);

    return successResponse;
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
