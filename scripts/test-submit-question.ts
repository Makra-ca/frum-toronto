/**
 * Test script to verify question submission and email sending
 * Run: npx tsx scripts/test-submit-question.ts
 */
import { neon } from "@neondatabase/serverless";
import { Resend } from "resend";
import * as dotenv from "dotenv";
dotenv.config();

const sql = neon(process.env.DATABASE_URL!);
const resend = new Resend(process.env.RESEND_API_KEY);
const EMAIL_FROM = process.env.EMAIL_FROM || "FrumToronto <noreply@frumtoronto.com>";

async function testSubmission() {
  console.log("🧪 Testing Ask the Rabbi submission...\n");

  // 1. Insert a test submission
  console.log("1. Inserting test submission...");
  const [submission] = await sql`
    INSERT INTO ask_the_rabbi_submissions (user_id, name, email, question, status)
    VALUES (1, 'Test User', 'test@example.com', 'This is a test question from the CLI script. Does this work?', 'pending')
    RETURNING *
  `;
  console.log("   ✓ Submission created:", submission);

  // 2. Get recipients
  console.log("\n2. Fetching email recipients...");
  const recipients = await sql`
    SELECT * FROM form_email_recipients
    WHERE form_type = 'ask_the_rabbi' AND is_active = true
  `;
  console.log("   ✓ Recipients:", recipients.map((r: any) => r.email));

  // 3. Send test email
  if (recipients.length > 0) {
    console.log("\n3. Sending notification email...");
    const recipientEmails = recipients.map((r: any) => r.email);

    try {
      const { data, error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: recipientEmails,
        subject: `[TEST] New Ask The Rabbi Question from Test User`,
        html: `
          <h2>Test Question Submission</h2>
          <p><strong>From:</strong> Test User (test@example.com)</p>
          <p><strong>Question:</strong></p>
          <blockquote style="border-left: 4px solid #7c3aed; padding-left: 15px; color: #555;">
            This is a test question from the CLI script. Does this work?
          </blockquote>
          <p style="color: #888; font-size: 12px;">This is a test email from the CLI script.</p>
        `,
      });

      if (error) {
        console.log("   ✗ Email error:", error);
      } else {
        console.log("   ✓ Email sent! ID:", data?.id);
      }
    } catch (err) {
      console.log("   ✗ Email failed:", err);
    }
  } else {
    console.log("\n3. No recipients configured, skipping email.");
  }

  // 4. Verify submission in DB
  console.log("\n4. Verifying submission in database...");
  const [verify] = await sql`
    SELECT * FROM ask_the_rabbi_submissions WHERE id = ${submission.id}
  `;
  console.log("   ✓ Found in DB:", verify ? "Yes" : "No");

  // 5. Clean up test data
  console.log("\n5. Cleaning up test submission...");
  await sql`DELETE FROM ask_the_rabbi_submissions WHERE id = ${submission.id}`;
  console.log("   ✓ Test submission deleted");

  console.log("\n✅ Test complete! Check your email inbox.");
}

testSubmission().catch(console.error);
