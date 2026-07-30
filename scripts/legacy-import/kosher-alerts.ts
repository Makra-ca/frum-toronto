/**
 * Imports the 1,587 legacy kosher alerts (FrumShared BlogEntries category 43)
 * into `kosher_alerts`.
 *
 *   npx tsx scripts/legacy-import/kosher-alerts.ts                 # dry run
 *   npx tsx scripts/legacy-import/kosher-alerts.ts --commit
 *   npx tsx scripts/legacy-import/kosher-alerts.ts --repair --commit
 *
 * Mapping notes:
 *
 * - product_name comes from the legacy title (longest observed: 153 chars, so it
 *   fits the varchar(200) column) and description from the body. Both are
 *   NOT NULL and neither is empty anywhere in the source.
 *
 * - The public page renders `{alert.description}` with `whitespace-pre-wrap`, so
 *   the body is converted to plain text with real newlines rather than HTML.
 *
 * - certifying_agency is resolved title -> legacy BlogImage badge ("COR.JPG")
 *   -> body text. The badge is a good signal but not authoritative: row 36169 is
 *   titled "MK Pesach Magazine 2026" yet carries COR.JPG. Body text comes last
 *   because short agency names like "OK" and "MK" collide with ordinary words.
 *
 * - brand stays NULL. It is not a separate legacy field and splitting it out of
 *   a product title by guesswork would invent data.
 *
 * - effective_date stays NULL (never recorded); issue_date is the post date.
 *
 * - KNOWN CONTENT LOSS: many alerts embedded an image carrying the actual
 *   information (e.g. a Costco Kosher-for-Passover list). Those files were
 *   served from www.frumtoronto.com/Local/CalendarImages/ and from the old
 *   server directly; both now return 404, so the images cannot be preserved or
 *   rehosted. The count of affected alerts is reported by this script.
 */
import {
  announce,
  chunk,
  connectLegacy,
  connectTarget,
  fit,
  htmlToLine,
  htmlToText,
  loadLegacyEnv,
  oleToDateString,
  oleToTimestamp,
  parseOptions,
} from "./lib";
import { classifyKosherAlert, detectCertifyingAgency } from "./parse";

const KOSHER_CATEGORY = 43;

interface Entry {
  BlogEntryID: number;
  Active: boolean | null;
  OnHold: boolean | null;
  BlogEntryDate: number | null;
  BlogEntryTitle: string | null;
  BlogEntryText: string | null;
  BlogImage: string | null;
}

/** "COR.JPG" -> "COR". The old site attached the agency's badge image. */
function agencyFromBadge(blogImage: string | null): string | null {
  if (!blogImage) return null;
  const base = blogImage.replace(/\.[a-z0-9]+$/i, "").trim();
  const known: Record<string, string> = {
    cor: "COR",
    ou: "OU",
    ok: "OK",
    "star-k": "Star-K",
    stark: "Star-K",
    "kof-k": "Kof-K",
    kofk: "Kof-K",
    crc: "cRc",
    mk: "MK",
    badatz: "Badatz",
  };
  return known[base.toLowerCase()] ?? null;
}

async function main() {
  const opts = parseOptions();
  const repairMode = process.argv.includes("--repair");
  loadLegacyEnv();
  const target = connectTarget(opts.useTest);
  announce("LEGACY KOSHER ALERT IMPORT — BlogEntries(43) -> kosher_alerts", opts, target);

  const pool = await connectLegacy("FrumShared");
  const entries: Entry[] = (
    await pool.request().query(`
      SELECT BlogEntryID, Active, OnHold, BlogEntryDate, BlogEntryTitle,
             BlogEntryText, BlogImage
      FROM BlogEntries WHERE BlogCategoryID = ${KOSHER_CATEGORY}
      ORDER BY BlogEntryDate, BlogEntryID`)
  ).recordset;
  await pool.close();
  console.log(`Read ${entries.length} legacy kosher alerts.`);

  const existing = (await target.sql.query(
    `SELECT old_id FROM kosher_alerts WHERE old_id IS NOT NULL`
  )) as { old_id: number }[];
  const already = new Set(existing.map((r) => r.old_id));
  console.log(`Already imported: ${already.size}`);

  let pending = repairMode
    ? entries.filter((e) => already.has(e.BlogEntryID))
    : entries.filter((e) => !already.has(e.BlogEntryID));
  if (opts.limit) pending = pending.slice(0, opts.limit);

  interface Prepared {
    oldId: number;
    productName: string;
    description: string;
    alertType: string;
    agency: string | null;
    issueDate: string | null;
    isActive: boolean;
    createdAt: Date;
    hadImage: boolean;
  }

  const prepared: Prepared[] = [];
  const skipped: { id: number; why: string }[] = [];

  for (const e of pending) {
    const title = htmlToLine(e.BlogEntryTitle);
    const body = htmlToText(e.BlogEntryText);
    const createdAt = oleToTimestamp(e.BlogEntryDate);

    if (!createdAt) {
      skipped.push({ id: e.BlogEntryID, why: "unparseable BlogEntryDate" });
      continue;
    }
    if (!title && !body) {
      skipped.push({ id: e.BlogEntryID, why: "empty title and body" });
      continue;
    }

    prepared.push({
      oldId: e.BlogEntryID,
      productName: fit(title || body.split("\n")[0], 200),
      description: body || title,
      alertType: classifyKosherAlert(title, body),
      // Title first: it is short and product-focused, so a named agency there is
      // authoritative. The legacy badge is next — but it is not always right
      // (row 36169 is titled "MK Pesach Magazine" yet carries COR.JPG). Body
      // text is the last resort because short agency names like "OK" and "MK"
      // collide with ordinary words in prose.
      agency:
        detectCertifyingAgency(title) ??
        agencyFromBadge(e.BlogImage) ??
        detectCertifyingAgency(body),
      issueDate: oleToDateString(e.BlogEntryDate),
      isActive: e.Active !== false && e.OnHold !== true,
      createdAt,
      // Detected on the raw body, before tags are stripped.
      hadImage: /<\s*img\b/i.test(e.BlogEntryText || ""),
    });
  }

  const byType = new Map<string, number>();
  const byAgency = new Map<string, number>();
  for (const p of prepared) {
    byType.set(p.alertType, (byType.get(p.alertType) ?? 0) + 1);
    const a = p.agency ?? "(none detected)";
    byAgency.set(a, (byAgency.get(a) ?? 0) + 1);
  }

  console.log("\nPLAN");
  console.log(`  to ${repairMode ? "repair" : "insert"} : ${prepared.length}`);
  console.log(`  skipped   : ${skipped.length}`);
  console.log(`  inactive  : ${prepared.filter((p) => !p.isActive).length}`);

  console.log("\n  alert_type distribution:");
  for (const [k, v] of [...byType.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(15)} ${v}`);
  }
  console.log("\n  certifying_agency distribution:");
  for (const [k, v] of [...byAgency.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(18)} ${v}`);
  }

  const lostImages = prepared.filter((p) => p.hadImage).length;
  console.log(
    `\n  CONTENT LOSS: ${lostImages} alerts embedded an image whose URL is now dead (404) and cannot be preserved.`
  );

  console.log("\n  sample:");
  for (const p of prepared.slice(-4)) {
    console.log(`    #${p.oldId} [${p.alertType}] agency=${p.agency ?? "-"} ${p.issueDate}`);
    console.log(`      name: ${p.productName}`);
    console.log(`      desc: ${p.description.replace(/\n/g, " / ").slice(0, 120)}`);
  }

  if (skipped.length) {
    console.log("\n  skipped:");
    skipped.slice(0, 10).forEach((s) => console.log(`    #${s.id}: ${s.why}`));
  }

  if (!opts.commit) {
    console.log("\nDRY RUN — nothing written. Re-run with --commit to apply.");
    return;
  }
  if (prepared.length === 0) {
    console.log("\nNothing to do.");
    return;
  }

  if (repairMode) {
    console.log("\nRepairing...");
    let n = 0;
    for (const batch of chunk(prepared, 200)) {
      const values: unknown[] = [];
      const tuples: string[] = [];
      batch.forEach((p, i) => {
        const b = i * 5;
        tuples.push(
          `($${b + 1}::int, $${b + 2}::text, $${b + 3}::text, $${b + 4}::text, $${b + 5}::text)`
        );
        values.push(p.oldId, p.productName, p.description, p.alertType, p.agency);
      });
      await target.sql.query(
        `UPDATE kosher_alerts AS k
            SET product_name = v.product_name,
                description = v.description,
                alert_type = v.alert_type,
                certifying_agency = v.certifying_agency
           FROM (VALUES ${tuples.join(",")})
                AS v(old_id, product_name, description, alert_type, certifying_agency)
          WHERE k.old_id = v.old_id
            AND (k.product_name <> v.product_name
                 OR k.description <> v.description
                 OR k.alert_type IS DISTINCT FROM v.alert_type
                 OR k.certifying_agency IS DISTINCT FROM v.certifying_agency)`,
        values
      );
      n += batch.length;
      console.log(`  processed ${n}/${prepared.length}`);
    }
    console.log(`\nDONE. Repair pass covered ${n} rows.`);
    return;
  }

  console.log("\nInserting...");
  let done = 0;
  for (const batch of chunk(prepared, 200)) {
    const values: unknown[] = [];
    const tuples: string[] = [];
    batch.forEach((p, i) => {
      const b = i * 8;
      tuples.push(
        `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8})`
      );
      values.push(
        p.productName,
        p.description,
        p.alertType,
        p.agency,
        p.issueDate,
        p.isActive,
        p.createdAt.toISOString(),
        p.oldId
      );
    });
    await target.sql.query(
      `INSERT INTO kosher_alerts
         (product_name, description, alert_type, certifying_agency, issue_date,
          is_active, created_at, old_id)
       VALUES ${tuples.join(",")}
       ON CONFLICT (old_id) WHERE old_id IS NOT NULL DO NOTHING`,
      values
    );
    done += batch.length;
    console.log(`  ${done}/${prepared.length}`);
  }

  // These were all published on the old site, so they are approved on arrival.
  await target.sql.query(
    `UPDATE kosher_alerts SET approval_status = 'approved'
      WHERE old_id IS NOT NULL AND approval_status <> 'approved'`
  );

  console.log(`\nDONE. kosher_alerts +${done}`);
}

main().catch((e) => {
  console.error("\nERROR:", e instanceof Error ? e.stack : e);
  process.exit(1);
});
