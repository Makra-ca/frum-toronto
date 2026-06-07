/**
 * Copies any event_submission / classified_submission form recipient rows
 * into daily_digest rows (dedup by email).
 *
 * Those two form types are Tier B (no instant email) under the notification
 * project — recipients configured under them intended "I want to hear about
 * events/classifieds", which is now served by the daily digest.
 *
 * Run with: npx tsx scripts/migrate-digest-recipients.ts
 */
import { db } from "../src/lib/db";
import { formEmailRecipients } from "../src/lib/db/schema";
import { eq, or } from "drizzle-orm";

async function migrateDigestRecipients() {
  console.log("Migrating event/classified recipients into daily_digest...");

  try {
    // Source rows: active recipients for the two Tier B form types
    const sourceRows = await db
      .select()
      .from(formEmailRecipients)
      .where(
        or(
          eq(formEmailRecipients.formType, "event_submission"),
          eq(formEmailRecipients.formType, "classified_submission")
        )
      );

    if (sourceRows.length === 0) {
      console.log("No event_submission/classified_submission recipients found. Nothing to do.");
      return;
    }

    // Existing daily_digest recipients (for dedup by email)
    const existingDigest = await db
      .select({ email: formEmailRecipients.email })
      .from(formEmailRecipients)
      .where(eq(formEmailRecipients.formType, "daily_digest"));

    const existingEmails = new Set(existingDigest.map((r) => r.email.toLowerCase()));

    // Dedup source rows by email (and against existing digest rows)
    const toInsert: { formType: string; email: string; name: string | null; isActive: boolean }[] = [];
    for (const row of sourceRows) {
      const email = row.email.toLowerCase();
      if (existingEmails.has(email)) continue;
      existingEmails.add(email);
      toInsert.push({
        formType: "daily_digest",
        email,
        name: row.name || null,
        isActive: row.isActive ?? true,
      });
    }

    if (toInsert.length === 0) {
      console.log(`All ${sourceRows.length} recipient(s) already exist under daily_digest. Nothing to insert.`);
      return;
    }

    await db.insert(formEmailRecipients).values(toInsert);

    console.log(`Inserted ${toInsert.length} daily_digest recipient(s):`);
    toInsert.forEach((r) => console.log(`  - ${r.email}`));
    console.log("Done. (Original event_submission/classified_submission rows left intact.)");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

migrateDigestRecipients();
