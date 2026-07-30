/**
 * Reconciles every legacy import against the legacy source.
 *
 *   npx tsx scripts/legacy-import/verify-all.ts
 *
 * Compares source row counts to imported counts per table, then checks the
 * invariants that would indicate a broken import: duplicate old_id, leftover
 * markup or control characters in plain-text columns, empty NOT NULL columns,
 * and orphaned foreign keys.
 */
import { connectLegacy, connectTarget, loadLegacyEnv, parseOptions } from "./lib";

interface Check {
  label: string;
  got: number;
  want: number | null;
  /** true when got must equal want; false when it just has to be zero. */
  exact: boolean;
}

async function main() {
  const opts = parseOptions();
  loadLegacyEnv();
  const target = connectTarget(opts.useTest);
  console.log("=".repeat(72));
  console.log("LEGACY IMPORT RECONCILIATION");
  console.log("=".repeat(72));
  console.log(`Target: ${target.host}\n`);

  const one = async (sqlText: string, params: unknown[] = []): Promise<number> => {
    const r = (await target.sql.query(sqlText, params)) as Record<string, unknown>[];
    return Number(Object.values(r[0] ?? { n: 0 })[0] ?? 0);
  };

  // ---- Source counts ----------------------------------------------------
  const shared = await connectLegacy("FrumShared");
  const srcCounts = (
    await shared.request().query(`
      SELECT BlogCategoryID cat, COUNT(*) n FROM BlogEntries
      WHERE BlogCategoryID IN (114,115,116,117,29,85,43,44,96,45)
      GROUP BY BlogCategoryID`)
  ).recordset as { cat: number; n: number }[];
  const src = new Map(srcCounts.map((r) => [r.cat, r.n]));
  const atrStrays = (
    await shared.request().query(`
      SELECT COUNT(*) n FROM BlogEntries
      WHERE BlogCategoryID = 44 AND LTRIM(BlogEntryTitle) LIKE '#%'`)
  ).recordset[0].n as number;
  await shared.close();

  const tor = await connectLegacy("FrumToronto");
  const memberSrc = (
    await tor.request().query(`
      SELECT COUNT(*) total,
             SUM(CASE WHEN RemoveMe = 1 THEN 1 ELSE 0 END) removeMe
      FROM MemberList`)
  ).recordset[0] as { total: number; removeMe: number };
  const removeMeIds = (
    await tor.request().query(`SELECT MemberID FROM MemberList WHERE RemoveMe = 1`)
  ).recordset.map((r: { MemberID: number }) => r.MemberID);
  await tor.close();

  const simchaSrc =
    (src.get(114) ?? 0) + (src.get(115) ?? 0) + (src.get(116) ?? 0) + (src.get(117) ?? 0) + (src.get(29) ?? 0);
  const blogSrc = (src.get(44) ?? 0) + (src.get(96) ?? 0) + (src.get(45) ?? 0) - atrStrays;

  // ---- Row-count reconciliation ----------------------------------------
  const counts: Check[] = [
    { label: "simchas imported", got: await one(`SELECT COUNT(*) n FROM simchas WHERE old_id IS NOT NULL`), want: simchaSrc, exact: true },
    { label: "shiva imported", got: await one(`SELECT COUNT(*) n FROM shiva_notifications WHERE old_id IS NOT NULL`), want: src.get(85) ?? 0, exact: true },
    { label: "kosher alerts imported", got: await one(`SELECT COUNT(*) n FROM kosher_alerts WHERE old_id IS NOT NULL`), want: src.get(43) ?? 0, exact: true },
    { label: "blog posts imported", got: await one(`SELECT COUNT(*) n FROM blog_posts WHERE old_id IS NOT NULL`), want: blogSrc, exact: true },
    { label: "members -> subscribers", got: await one(`SELECT COUNT(*) n FROM email_subscribers WHERE old_member_id IS NOT NULL`), want: null, exact: false },
  ];

  console.log("ROW COUNTS (imported vs legacy source)");
  let countsOk = true;
  for (const c of counts) {
    if (c.want === null) {
      console.log(`  ${c.label.padEnd(26)} ${c.got}`);
      continue;
    }
    const ok = c.got === c.want;
    if (!ok) countsOk = false;
    console.log(`  ${c.label.padEnd(26)} ${String(c.got).padStart(6)} / ${String(c.want).padStart(6)} ${ok ? "ok" : "MISMATCH"}`);
  }
  console.log(`  (legacy MemberList: ${memberSrc.total} rows, ${memberSrc.removeMe} opted out of email)`);

  // ---- Invariants -------------------------------------------------------
  const zeroChecks: [string, number][] = [
    ["duplicate simcha old_id", await one(`SELECT COUNT(*) n FROM (SELECT old_id FROM simchas WHERE old_id IS NOT NULL GROUP BY old_id HAVING COUNT(*)>1) x`)],
    ["duplicate shiva old_id", await one(`SELECT COUNT(*) n FROM (SELECT old_id FROM shiva_notifications WHERE old_id IS NOT NULL GROUP BY old_id HAVING COUNT(*)>1) x`)],
    ["duplicate kosher old_id", await one(`SELECT COUNT(*) n FROM (SELECT old_id FROM kosher_alerts WHERE old_id IS NOT NULL GROUP BY old_id HAVING COUNT(*)>1) x`)],
    ["duplicate blog old_id", await one(`SELECT COUNT(*) n FROM (SELECT old_id FROM blog_posts WHERE old_id IS NOT NULL GROUP BY old_id HAVING COUNT(*)>1) x`)],
    ["duplicate old_member_id", await one(`SELECT COUNT(*) n FROM (SELECT old_member_id FROM email_subscribers WHERE old_member_id IS NOT NULL GROUP BY old_member_id HAVING COUNT(*)>1) x`)],

    // Plain-text columns must not contain markup, entities or C1 controls.
    ["simchas with markup/entities", await one(`SELECT COUNT(*) n FROM simchas WHERE old_id IS NOT NULL AND (announcement ~ '<[a-zA-Z/][^>]*>' OR announcement LIKE '%&#%' OR announcement LIKE '%&amp;%' OR announcement LIKE '%&nbsp;%')`)],
    ["simchas with control chars", await one(`SELECT COUNT(*) n FROM simchas WHERE old_id IS NOT NULL AND announcement ~ '[\\u0080-\\u009F]'`)],
    ["kosher alerts with markup", await one(`SELECT COUNT(*) n FROM kosher_alerts WHERE old_id IS NOT NULL AND (description ~ '<[a-zA-Z/][^>]*>' OR description LIKE '%&#%' OR description LIKE '%&amp;%')`)],
    ["shiva notices with markup", await one(`SELECT COUNT(*) n FROM shiva_notifications WHERE old_id IS NOT NULL AND (notice_text ~ '<[a-zA-Z/][^>]*>' OR notice_text LIKE '%&#%')`)],

    // Blog keeps HTML but must not keep anything executable.
    ["blog posts with <script>", await one(`SELECT COUNT(*) n FROM blog_posts WHERE old_id IS NOT NULL AND content ~* '<\\s*script'`)],
    ["blog posts with on* handler", await one(`SELECT COUNT(*) n FROM blog_posts WHERE old_id IS NOT NULL AND content ~* '\\son[a-z]+\\s*='`)],
    ["blog posts with javascript:", await one(`SELECT COUNT(*) n FROM blog_posts WHERE old_id IS NOT NULL AND content ~* 'javascript\\s*:'`)],
    ["blog posts with iframe", await one(`SELECT COUNT(*) n FROM blog_posts WHERE old_id IS NOT NULL AND content ~* '<\\s*iframe'`)],
    ["blog posts with dead image", await one(`SELECT COUNT(*) n FROM blog_posts WHERE old_id IS NOT NULL AND content ~* '<img[^>]*(frumtoronto\\.com|216\\.105\\.90\\.65)'`)],

    // NOT NULL columns must not be empty strings.
    ["empty simcha required fields", await one(`SELECT COUNT(*) n FROM simchas WHERE old_id IS NOT NULL AND (family_name = '' OR announcement = '')`)],
    ["empty shiva niftar_name", await one(`SELECT COUNT(*) n FROM shiva_notifications WHERE old_id IS NOT NULL AND niftar_name = ''`)],
    ["empty kosher required fields", await one(`SELECT COUNT(*) n FROM kosher_alerts WHERE old_id IS NOT NULL AND (product_name = '' OR description = '')`)],
    ["empty blog required fields", await one(`SELECT COUNT(*) n FROM blog_posts WHERE old_id IS NOT NULL AND (title = '' OR slug = '' OR content = '')`)],

    // Referential integrity.
    ["subscribers without a user", await one(`SELECT COUNT(*) n FROM email_subscribers WHERE old_member_id IS NOT NULL AND user_id IS NULL`)],
    ["blog posts with bad author", await one(`SELECT COUNT(*) n FROM blog_posts p WHERE p.old_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p.author_id)`)],
    ["simchas with bad type_id", await one(`SELECT COUNT(*) n FROM simchas s WHERE s.old_id IS NOT NULL AND s.type_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM simcha_types t WHERE t.id = s.type_id)`)],

    // Opt-outs must not have been given a subscriber row.
    ["opted-out members emailable", await one(`SELECT COUNT(*) n FROM email_subscribers WHERE old_member_id = ANY($1::int[])`, [removeMeIds])],
  ];

  console.log("\nINVARIANTS (all must be 0)");
  let invariantsOk = true;
  for (const [label, n] of zeroChecks) {
    if (n !== 0) invariantsOk = false;
    console.log(`  ${label.padEnd(32)} ${String(n).padStart(5)} ${n === 0 ? "ok" : "FAIL"}`);
  }

  // ---- Totals for the record -------------------------------------------
  console.log("\nTABLE TOTALS (imported + pre-existing)");
  for (const t of ["users", "email_subscribers", "simchas", "shiva_notifications", "kosher_alerts", "blog_posts", "blog_categories"]) {
    console.log(`  ${t.padEnd(22)} ${await one(`SELECT COUNT(*) n FROM ${t}`)}`);
  }

  const ok = countsOk && invariantsOk;
  console.log(`\n${ok ? "ALL CHECKS PASSED" : "*** CHECKS FAILED — see above ***"}`);
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error("\nERROR:", e instanceof Error ? e.stack : e);
  process.exit(1);
});
