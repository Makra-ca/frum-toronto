/**
 * Repoint stored notification rows at the Comments tab.
 *
 * Task 9 deleted /admin/programs/rabbi/comments and updated the three code
 * sites that generated that path. Rows already written still carry the old URL
 * and would 404 after deploy.
 *
 * Dry-run by default; pass --commit to apply.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const COMMIT = process.argv.includes("--commit");
const OLD = "/admin/programs/rabbi/comments";
const NEW = "/admin/programs/rabbi?tab=comments";

async function main() {
  const { db } = await import("@/lib/db");
  const { notifications } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");

  const stale = await db
    .select({
      id: notifications.id,
      userId: notifications.userId,
      type: notifications.type,
      isRead: notifications.isRead,
      linkUrl: notifications.linkUrl,
    })
    .from(notifications)
    .where(eq(notifications.linkUrl, OLD));

  console.log(`Rows still pointing at the deleted page: ${stale.length}`);
  for (const r of stale) {
    console.log(`  #${r.id} user=${r.userId} type=${r.type} read=${r.isRead}`);
  }

  if (stale.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  if (!COMMIT) {
    console.log(`\nDRY RUN — would set link_url to "${NEW}". Pass --commit to apply.`);
    return;
  }

  const updated = await db
    .update(notifications)
    .set({ linkUrl: NEW })
    .where(eq(notifications.linkUrl, OLD))
    .returning({ id: notifications.id });

  console.log(`Repointed ${updated.length} row(s).`);

  const left = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(eq(notifications.linkUrl, OLD));
  console.log(`Remaining stale rows: ${left.length} (expected 0)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
