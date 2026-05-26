export function getVerificationEmailHtml(verificationUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background-color: #1e3a8a; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                Frum<span style="color: #60a5fa;">Toronto</span>
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1e3a8a; font-size: 24px;">Welcome to FrumToronto!</h2>
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                Thank you for registering. Please verify your email address by clicking the button below:
              </p>

              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${verificationUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
              </p>

              <p style="margin: 20px 0 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${verificationUrl}" style="color: #2563eb; word-break: break-all;">${verificationUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                &copy; ${new Date().getFullYear()} FrumToronto. The Toronto Jewish Orthodox Community Gateway.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function getPasswordResetEmailHtml(resetUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background-color: #1e3a8a; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                Frum<span style="color: #60a5fa;">Toronto</span>
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1e3a8a; font-size: 24px;">Reset Your Password</h2>
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                You requested a password reset for your FrumToronto account. Click the button below to set a new password:
              </p>

              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${resetUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
              </p>

              <p style="margin: 20px 0 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                &copy; ${new Date().getFullYear()} FrumToronto. The Toronto Jewish Orthodox Community Gateway.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function getClassifiedContactEmailHtml(params: {
  listingTitle: string;
  listingUrl: string;
  senderName: string;
  senderEmail: string;
  message: string;
}): string {
  const { listingTitle, listingUrl, senderName, senderEmail, message } = params;
  const year = new Date().getFullYear();

  const safeTitle = escapeHtml(listingTitle);
  const safeName = escapeHtml(senderName);
  const safeEmail = escapeHtml(senderEmail);
  const safeMessage = escapeHtml(message);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background-color: #1e3a8a; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                Frum<span style="color: #60a5fa;">Toronto</span>
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 8px; color: #1e3a8a; font-size: 22px;">Someone is interested in your listing</h2>
              <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">
                Listing: <strong>${safeTitle}</strong>
              </p>

              <!-- Sender info box -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 4px; color: #374151; font-size: 14px;"><strong>From:</strong> ${safeName}</p>
                    <p style="margin: 0; color: #2563eb; font-size: 14px;"><strong>Email:</strong> <a href="mailto:${safeEmail}" style="color: #2563eb; text-decoration: none;">${safeEmail}</a></p>
                  </td>
                </tr>
              </table>

              <!-- Message -->
              <h3 style="margin: 0 0 12px; color: #374151; font-size: 16px;">Their message:</h3>
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-left: 4px solid #e5e7eb; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${safeMessage}</p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                To reply, simply respond to this email or email ${safeName} directly at <a href="mailto:${safeEmail}" style="color: #2563eb;">${safeEmail}</a>.
              </p>

              <!-- View listing button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="${listingUrl}" style="display: inline-block; background-color: #ea580c; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600;">
                      View Your Listing
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                This message was sent via FrumToronto Classifieds on behalf of ${safeName}.<br>
                &copy; ${year} FrumToronto. The Toronto Jewish Orthodox Community Gateway.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function generateAtrAnswerNotificationEmail(params: {
  questionTitle: string;
  questionUrl: string;
  answeredBy: string;
  recipientName: string;
}): string {
  const { questionTitle, questionUrl, answeredBy, recipientName } = params;
  const year = new Date().getFullYear();
  const safeTitle = questionTitle.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeName = recipientName.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeAnsweredBy = answeredBy.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your question has been answered</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Urbanist', 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background-color: #1e40af; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                Frum<span style="color: #93c5fd;">Toronto</span>
              </h1>
              <p style="margin: 8px 0 0; color: #bfdbfe; font-size: 14px;">Ask the Rabbi</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #1e3a8a; font-size: 22px; font-weight: 700;">
                Your question has been answered!
              </h2>
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                Hi ${safeName},
              </p>
              <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                Great news! The rabbi has answered your question on FrumToronto.
              </p>

              <!-- Question title box -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">
                <tr>
                  <td style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 16px 20px; border-radius: 4px;">
                    <p style="margin: 0; color: #1e3a8a; font-size: 16px; font-style: italic; line-height: 1.5;">
                      &ldquo;${safeTitle}&rdquo;
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${questionUrl}"
                       style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
                      View the Answer
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Answered by: <strong style="color: #374151;">${safeAnsweredBy}</strong>
              </p>

              <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                If you have more questions, you can always submit a new one at
                <a href="https://frumtoronto.com/ask-the-rabbi" style="color: #2563eb;">frumtoronto.com/ask-the-rabbi</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                &copy; ${year} FrumToronto. The Toronto Jewish Orthodox Community Gateway.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
