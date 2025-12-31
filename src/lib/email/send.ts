import { resend, EMAIL_FROM } from "./resend";
import { getVerificationEmailHtml, getPasswordResetEmailHtml } from "./templates";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  if (!resend) {
    console.error("Resend client not initialized - cannot send verification email");
    return false;
  }

  const verificationUrl = `${APP_URL}/verify-email?token=${token}`;

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Verify your email - FrumToronto",
      html: getVerificationEmailHtml(verificationUrl),
    });

    if (error) {
      console.error("Failed to send verification email:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending verification email:", error);
    return false;
  }
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
  if (!resend) {
    console.error("Resend client not initialized - cannot send password reset email");
    return false;
  }

  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Reset your password - FrumToronto",
      html: getPasswordResetEmailHtml(resetUrl),
    });

    if (error) {
      console.error("Failed to send password reset email:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return false;
  }
}
