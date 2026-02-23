import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, verificationTokens, emailSubscribers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { registerSchema } from "@/lib/validations/auth";
import { sendVerificationEmail } from "@/lib/email/send";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate input
    const result = registerSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password, firstName, lastName, notifications } = result.data;
    const normalizedEmail = email.toLowerCase();

    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        passwordHash: hashedPassword,
        firstName,
        lastName,
        role: "member",
        isActive: true,
        isTrusted: false,
      })
      .returning();

    // Generate unsubscribe token for email preferences
    const unsubscribeToken = crypto.randomBytes(32).toString("hex");

    // Create linked email subscriber record with notification preferences
    await db.insert(emailSubscribers).values({
      userId: newUser.id,
      email: normalizedEmail,
      firstName,
      lastName,
      newsletter: notifications?.newsletter ?? true,
      simchas: notifications?.simchas ?? false,
      shiva: notifications?.shiva ?? false,
      kosherAlerts: notifications?.kosherAlerts ?? false,
      tehillim: notifications?.tehillim ?? false,
      communityEvents: notifications?.communityEvents ?? false,
      eruvStatus: notifications?.eruvStatus ?? false,
      isActive: true,
      unsubscribeToken,
    });

    // Generate verification token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.insert(verificationTokens).values({
      identifier: normalizedEmail,
      token,
      expires,
    });

    // Send verification email
    await sendVerificationEmail(email, token);

    return NextResponse.json({
      message: "Registration successful. Please check your email to verify your account.",
      userId: newUser.id,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "An error occurred during registration" },
      { status: 500 }
    );
  }
}
