/**
 * Read back the result of fix-bylines-and-test-post.ts. Read-only.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const RAV = "Hagaon Rav Shlomo Miller Shlit'a";

async function main() {
  const { db } = await import("@/lib/db");
  const { askTheRabbi } = await import("@/lib/db/schema");
  const { sql, eq, desc } = await import("drizzle-orm");

  const byline = await db
    .select({ by: askTheRabbi.answeredBy, c: sql<number>`count(*)` })
    .from(askTheRabbi)
    .groupBy(askTheRabbi.answeredBy)
    .orderBy(desc(sql`count(*)`));

  console.log("\nanswered_by distribution:");
  console.table(byline);

  const wrong = byline.filter((b) => b.by !== RAV);
  console.log(
    wrong.length === 0
      ? "All bylines are the Rav ✓"
      : `STILL WRONG: ${JSON.stringify(wrong)}`
  );

  const [gone] = await db
    .select({ id: askTheRabbi.id })
    .from(askTheRabbi)
    .where(eq(askTheRabbi.id, 5519));
  console.log(`Row 5519 present: ${gone ? "YES — repair incomplete" : "no ✓"}`);

  // Deliberately no hardcoded total: any Q&A published after this was written
  // would make a fixed count fail for the wrong reason.
  const [total] = await db.select({ c: sql<number>`count(*)` }).from(askTheRabbi);
  console.log(`Total Q&As: ${total.c} (informational)\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
