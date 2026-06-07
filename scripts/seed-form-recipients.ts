/**
 * Seeds Daniel@makra.ca as a recipient for every form type so admin
 * notification emails (instant + daily digest) actually have somewhere to go.
 *
 * Safe to re-run: it only inserts a row if that (formType, email) pair doesn't
 * already exist. Never deletes or overwrites anything.
 *
 * Run with:  npx dotenv -e .env -- npx tsx scripts/seed-form-recipients.ts
 */
import { db } from "@/lib/db";
import { formEmailRecipients } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { FORM_TYPES } from "@/app/api/admin/form-recipients/route";

const EMAIL = "Daniel@makra.ca";
const NAME = "Daniel";

async function main() {
  let inserted = 0;
  let skipped = 0;

  for (const { value: formType, label } of FORM_TYPES) {
    const existing = await db
      .select({ id: formEmailRecipients.id })
      .from(formEmailRecipients)
      .where(
        and(
          eq(formEmailRecipients.formType, formType),
          eq(formEmailRecipients.email, EMAIL)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      console.log(`  skip  ${formType} (${label}) — already present`);
      skipped++;
      continue;
    }

    await db.insert(formEmailRecipients).values({
      formType,
      email: EMAIL,
      name: NAME,
      isActive: true,
    });
    console.log(`  add   ${formType} (${label})`);
    inserted++;
  }

  console.log(`\nDone. Inserted ${inserted}, skipped ${skipped}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
